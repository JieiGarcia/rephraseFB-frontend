import React, {useState, useRef, useCallback, useEffect} from 'react';

// Japanese character detection utility
const JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

// Sentence tracking interface for evolution paths
interface Sentence {
  text: string;
  evolutions: string[];
  rejected?: boolean; // Flag to prevent re-analysis after user rejection
}

// Helper functions for Sentence objects
const createSentence = (text: string): Sentence => ({
  text,
  evolutions: []
});

const evolveSentence = (current: Sentence, newText: string): Sentence => ({
  text: newText,
  evolutions: [...current.evolutions, current.text]
});

const findSentenceByText = (sentences: Sentence[], text: string): Sentence | undefined => {
  return sentences.find(s => s.text === text);
};


/**
 * Extracts sentences from text using both English and Japanese punctuation marks
 * @param text - The text to analyze
 * @returns Array of sentences
 */
const getSentencesFromText = (text: string): string[] => {
    // Include both English (.!?) and Japanese (。！？) punctuation
    // Also includes punctuation followed by quotes: .", .', !", !', ?", ?'
    const sentenceRegex = /[^.!?。！？]+[.!?。！？]["']?/g;
    const matches = text.match(sentenceRegex) || [];

    // Track quote completion for each sentence
    const processedMatches = matches.map(sentence => {
        // Check if sentence contains any quotation marks (excluding single quotes for contractions)
        const hasQuotes = sentence.includes('"');

        if (hasQuotes) {
            // For now, just return the sentence (quote tracking logic to be added later)
            // TODO: Use quotation_closed filter logic here
                    }

        return sentence.trim();
    });

    return processedMatches;
};

/**
 * Detects if text contains Japanese characters (Hiragana, Katakana, or Kanji)
 * @param text - The text to analyze
 * @returns boolean indicating if Japanese characters are found
 */
const containsJapanese = (text: string): boolean => {
    return JAPANESE_REGEX.test(text);
};

/**
 * Detects if a sentence contains only English text (no Japanese characters)
 * @param sentence - The sentence to analyze
 * @returns boolean indicating if sentence is English-only
 */
const isEnglishOnlySentence = (sentence: string): boolean => {
    return !containsJapanese(sentence);
};

/**
 * Detects if text contains English characters (letters a-z, A-Z)
 * @param text - The text to analyze
 * @returns boolean indicating if English characters are found
 */
const containsEnglish = (text: string): boolean => {
    return /[a-zA-Z]/.test(text);
};

/**
 * Detects if a sentence contains both Japanese AND English characters
 * @param sentence - The sentence to analyze
 * @returns boolean indicating if sentence is mixed-language
 */
const isMixedLanguageSentence = (sentence: string): boolean => {
    return containsJapanese(sentence) && containsEnglish(sentence);
};

/**
 * Normalizes text by converting problematic whitespace to standard spaces
 * @param text - The text to normalize
 * @returns Normalized text
 */
const normalizeText = (text: string): string => {
    const regexNormalize = /[\r\n\u00A0]/g;
    return text.replace(regexNormalize, ' ');
};


/**
   * Debounces a function to prevent rapid execution
   * @param func - The function to debounce
   * @param wait - Delay in milliseconds
   * @returns Debounced function
*/
function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Legacy-style global variables for tracking state (like logic.js)
let englishSentences: Sentence[] = []; // English sentences pending naturalness checking (now with evolution tracking)
let naturalnessCheckedSentences: Sentence[] = []; // English sentences that completed naturalness analysis (now with evolution tracking)
let lastAnalyzedText: string = '';
let lastJapaneseText: string = ''; // Track last Japanese text for avoiding redundant analysis

interface WritingAreaProps {
    content?: string;
    placeholder?: string;
    userId?: string;
    taskCondition?: 'control' | 'experimental';
    internalUserId?: string | null;
    currentTaskId?: string | null;
    onTextChange?: (content: string) => void;
    onJapaneseDetected?: (hasJapanese: boolean) => void;
}

export default function WritingArea({
    content: initialContent = '',
    placeholder = "Start writing...",
    taskCondition,
    internalUserId,
    currentTaskId,
    onTextChange,
    onJapaneseDetected
}: WritingAreaProps){
    // State for managing the content
    const [content, setContent] = useState(initialContent);
    
    // Tracking IME composition
    const [isComposing, setIsComposing] = useState(false);
    
    // Ref for direct access to the contentEditable element
    const editorRef = useRef<HTMLDivElement>(null);

    // Ref for the document-paper container for positioning underlines
    const documentPaperRef = useRef<HTMLDivElement>(null);

    // Ref to track the last Japanese detection state to avoid unnecessary callbacks
    const lastJapaneseState = useRef<boolean>(false);

    // --- 一時的なダミー関数---
    const getSuggestion = async (args: { target_sentence: string; context: string }) => {
        const response = await fetch("http://localhost:8080/suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(args),
        });
        const data = await response.json();
        return data.suggestion;
    };
    const getNaturalnessSuggestion = async (args: { sentence: string; context: string; evolutions?: string[] }) => {
        try {
            const response = await fetch("http://localhost:8080/naturalness", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args),
            });

            if (!response.ok) {
                throw new Error("Naturalness API error");
            }

            // AIが返したJSONをそのままパースして返す
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Failed to get naturalness suggestion:", error);
            return { is_perfect: true, suggestion: "", category: "", reason: "" };
        }
    };
    const generateSpeech = async (args: { text: string }) => {
        try {
            const response = await fetch("http://localhost:8080/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args),
            });

            if (!response.ok) {
                throw new Error(`TTS API error! status: ${response.status}`);
            }

            // 返ってきたMP3のバイナリデータをBlobとして取得
            const blob = await response.blob();
            // BlobからURLを生成
            const audioUrl = URL.createObjectURL(blob);
            
            return audioUrl;
        } catch (error) {
            console.error("Failed to generate speech via Go API:", error);
            return null;
        }
    };
    const submitTask = async (args: { taskId: string; finalText: string }) => {
        try {
            const response = await fetch(`http://localhost:8080/tasks/${args.taskId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    finalText: args.finalText
                }),
            });

            if (!response.ok) {
                throw new Error(`API error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Failed to submit task via Go API:", error);
            throw error;
        }
    };
    const logSuggestionOnce = async (args: any) => {
        try {
            await fetch("http://localhost:8080/suggestions/log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...args,
                    taskId: currentTaskId // 忘れずに現在のタスクIDを渡す
                }),
            });
            return { existing: false };
        } catch (error) {
            console.error("Failed to log suggestion:", error);
            return { existing: true };
        }
    };

    const updateSuggestionAction = async (args: { trackingId: string; newAction: string }) => {
        try {
            await fetch(`http://localhost:8080/suggestions/log/${args.trackingId}/action`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: args.newAction }),
            });
        } catch (error) {
            console.error("Failed to update action:", error);
        }
    };

    const logAudioPlay = async (args: { trackingId: string }) => {
        try {
            await fetch(`http://localhost:8080/suggestions/log/${args.trackingId}/audio`, {
                method: "PUT",
            });
        } catch (error) {
            console.error("Failed to log audio play:", error);
        }
    };
    // --------------------------------------------------------
    
    const [excludedButtons, setExcludedButtons] = useState<{text: string, id: string}[]>([]);
    // State for tracking which sentence has an active popup
    const [activePopup, setActivePopup] = useState<{text: string, position: {top?: number, bottom?: number, left: number, textRect?: {top: number, bottom: number, left: number, right: number, height: number}}, suggestion?: string, audioUrl?: string, isAudioGenerating?: boolean, trackingId?: string} | null>(null);

    // State for tracking current suggestion being processed
    const [currentSuggestion, setCurrentSuggestion] = useState<{
        originalText: string;
        suggestedText?: string;
        category: string;
        timestamp: number;
        trackingId?: string;
    } | null>(null);

    
    // State for tracking analyzed sentences with their categories
    const [analyzedSentences, setAnalyzedSentences] = useState<{[key: string]: {category: string, suggestion: string, reason: string, trackingId: string}}>({});

    // State for tracking which sentence has an active naturalness popup
    const [activeNaturalnessPopup, setActiveNaturalnessPopup] = useState<{sentence: string, position: {top?: number, bottom?: number, left: number, textRect?: {top: number, bottom: number, left: number, right: number, height: number}}, data: {category: string, suggestion: string, reason: string, trackingId: string, audioUrl?: string, isAudioGenerating?: boolean}} | null>(null);

    // Sync content when initialContent prop changes
    useEffect(() => {
        setContent(initialContent);
    }, [initialContent]);

    
    
    // Helper function to generate audio using Google TTS
    const generateAudioWithTTS = useCallback(async (text: string): Promise<string | null> => {
        try {
            const audioUrl = await generateSpeech({ text });
            return audioUrl;
        } catch (error) {
            console.error('Error generating audio:', error);
            return null;
        }
    }, [generateSpeech]);

    // Helper function to play audio from URL
    const playAudioFromUrl = useCallback(async (audioUrl: string, trackingId?: string) => {
        try {
            // Log audio play if trackingId is provided
            if (trackingId) {
                logAudioPlay({ trackingId }).catch(error => {
                    console.error('Failed to log audio play:', error);
                });
            }

            const audio = new Audio(audioUrl);
            audio.play().catch(error => {
                console.error('Audio playback failed:', error);
            });
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    }, [logAudioPlay]);

    // Helper function to find incomplete mixed-language text (not ending with punctuation)
    const findIncompleteJapaneseText = useCallback((text: string): string[] => {
        const incompleteJapanese: string[] = [];

        // Check if text ends with punctuation (including punctuation followed by quotes)
        const lastChar = text.trim().slice(-1);
        const lastTwoChars = text.trim().slice(-2);
        const hasPunctuation = ['.', '!', '?', '。', '！', '？'].includes(lastChar) ||
                               ['."', ".'", '!"', "!'", '?"', "?'"].includes(lastTwoChars);

        if (!hasPunctuation) {
            // Find text after last punctuation using regex to handle punctuation + quotes
            const punctuationWithQuotesRegex = /[.!?。！？]["']?/g;
            const matches = Array.from(text.matchAll(punctuationWithQuotesRegex));

            let lastPunctuationIndex = -1;
            if (matches.length > 0) {
                const lastMatch = matches[matches.length - 1];
                lastPunctuationIndex = lastMatch.index;
            }

            if (lastPunctuationIndex >= 0) {
                const lastMatch = matches[matches.length - 1];
                const matchEndIndex = lastPunctuationIndex + lastMatch[0].length;
                const afterPunctuation = text.substring(matchEndIndex).trim();
                if (afterPunctuation && isMixedLanguageSentence(afterPunctuation)) {
                    incompleteJapanese.push(afterPunctuation);
                }
            } else if (text.trim() && isMixedLanguageSentence(text.trim())) {
                // No punctuation found, but text contains both Japanese and English
                incompleteJapanese.push(text.trim());
            }
        }

        return incompleteJapanese;
    }, []);

    // Immediate analysis for real-time Japanese detection (separate from debounced analysis)
    const runImmediateAnalysis = useCallback((text: string) => {
        const currentSentences = getSentencesFromText(text);
        const incompleteJapanese = findIncompleteJapaneseText(text);

        // Combine mixed sentences (Japanese + English) and incomplete Japanese into excluded list
        const mixedSentences = currentSentences.filter(s => isMixedLanguageSentence(s));
        const excludedList = [...mixedSentences, ...incompleteJapanese];

        // Sync buttons with excluded list - always match exactly what's in excludedList
        const newButtons = excludedList.map(excludedItem => ({
            text: excludedItem,
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        }));
        setExcludedButtons(newButtons);
    }, [findIncompleteJapaneseText]);

    // Helper function to handle Japanese detection
    const handleJapaneseDetection = useCallback((text: string) => {
        const japaneseFound = containsJapanese(text);

        // Only notify if detection state has changed
        if (japaneseFound !== lastJapaneseState.current) {
            lastJapaneseState.current = japaneseFound;
            onJapaneseDetected?.(japaneseFound);
        }

        // Extract mixed-language content for comparison
        const getMixedContent = (text: string): string => {
            const currentSentences = getSentencesFromText(text);
            const incompleteJapanese = findIncompleteJapaneseText(text);
            const mixedSentences = currentSentences.filter(s => isMixedLanguageSentence(s));
            return [...mixedSentences, ...incompleteJapanese].join(' ');
        };

        // Only run immediate analysis when mixed-language content actually changes
        if (japaneseFound) {
            const currentMixedContent = getMixedContent(text);
            if (currentMixedContent !== lastJapaneseText) {
                lastJapaneseText = currentMixedContent;
                runImmediateAnalysis(text);
            }
        }
    }, [onJapaneseDetected, runImmediateAnalysis]);

    // Analysis Logic (Called by both debouncers - like legacy)
    const runAnalysis = useCallback((_source: string) => {

        // Skip all analysis in control mode
        if (taskCondition === 'control') {
            return;
        }

        const currentSentences = getSentencesFromText(lastAnalyzedText);

        // Find new/modified English sentences that need naturalness analysis
        for (const sentence of currentSentences) {
            const englishSentenceObj = findSentenceByText(englishSentences, sentence);
            const checkedSentenceObj = findSentenceByText(naturalnessCheckedSentences, sentence);
            const isInEnglishSentences = englishSentenceObj !== undefined;
            const isInNaturalnessChecked = checkedSentenceObj !== undefined;

            // Skip if sentence was rejected by user
            if ((englishSentenceObj && englishSentenceObj.rejected) || (checkedSentenceObj && checkedSentenceObj.rejected)) {
                continue;
            }

            // Check if sentence has quotes and if they are closed
            const hasQuotes = sentence.includes('"');
            let quotation_closed = true; // Default to true for sentences without quotes

            if (hasQuotes) {
                const doubleQuoteCount = (sentence.match(/"/g) || []).length;
                quotation_closed = doubleQuoteCount % 2 === 0; // Even number means quotes are closed
            }

            if (!isInEnglishSentences && !isInNaturalnessChecked && isEnglishOnlySentence(sentence) && quotation_closed) {

                // Extract context - all text before the target sentence
                const fullText = lastAnalyzedText;
                const sentenceIndex = fullText.indexOf(sentence);
                const context = sentenceIndex > 0 ? fullText.substring(0, sentenceIndex).trim() : '';

                // Get the sentence object to access evolution history
                const sentenceObj = createSentence(sentence); // Create new sentence object for first-time analysis
                const existingSentence = findSentenceByText(englishSentences, sentence);

                // Trigger naturalness analysis (async)
                getNaturalnessSuggestion({
                    sentence: sentence,
                    context: context,
                    evolutions: existingSentence?.evolutions || sentenceObj.evolutions
                }).then(response => {
                    
                    // Handle the new response structure
                    if (response.is_perfect) {
                    } else {
                        // Store analysis result for visual underlines
                        const trackingId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        setAnalyzedSentences(prev => ({
                            ...prev,
                            [sentence]: {
                                category: response.category,
                                suggestion: response.suggestion,
                                reason: response.reason,
                                trackingId: trackingId
                            }
                        }));
                    }

                    // Move sentence to naturalnessCheckedSentences after analysis
                    const sentenceObj = findSentenceByText(englishSentences, sentence);
                    if (sentenceObj && !findSentenceByText(naturalnessCheckedSentences, sentence)) {
                        // Remove from englishSentences and add to naturalnessCheckedSentences
                        const index = englishSentences.findIndex(s => s.text === sentence);
                        if (index !== -1) {
                            englishSentences.splice(index, 1);
                            naturalnessCheckedSentences.push(sentenceObj);
                                                    }
                    }
                }).catch(error => {
                    console.error(`Naturalness analysis failed for "${sentence}":`, error);
                });
            }
        }

        // Note: incompleteJapanese text is handled in the excluded list logging below

        // Clean up deleted sentences from tracking lists
        // const originalEnglishLength = englishSentences.length;
        // const originalNaturalnessLength = naturalnessCheckedSentences.length;

        // Remove deleted sentences from englishSentences
        englishSentences = englishSentences.filter(sentence => currentSentences.includes(sentence.text));

        // Remove deleted sentences from naturalnessCheckedSentences
        naturalnessCheckedSentences = naturalnessCheckedSentences.filter(sentence => currentSentences.includes(sentence.text));

        // Update sentence tracking - only add complete English sentences, exclude mixed sentences
        const newEnglishSentences = currentSentences.filter(sentence => isEnglishOnlySentence(sentence));

        // Convert string sentences to Sentence objects, preserving existing ones
        const updatedEnglishSentences: Sentence[] = [];
        for (const sentence of newEnglishSentences) {
            const existingSentence = findSentenceByText(englishSentences, sentence);
            const existingCheckedSentence = findSentenceByText(naturalnessCheckedSentences, sentence);

            if (existingSentence) {
                // Keep existing Sentence object with its evolutions
                updatedEnglishSentences.push(existingSentence);
            } else if (existingCheckedSentence) {
                // Keep existing from naturalnessCheckedSentences if found there
                updatedEnglishSentences.push(existingCheckedSentence);
            } else {
                // Create new Sentence object if this is a completely new sentence
                updatedEnglishSentences.push(createSentence(sentence));
            }
        }
        // Note: Buttons are now managed by immediate analysis, not here

        englishSentences = updatedEnglishSentences;
    }, [findIncompleteJapaneseText]);

    // Debounced analysis function (like legacy)
    // For newly appended sentences
    const debouncedAppendHandler = useCallback(
        debounce(() => runAnalysis("Append Handler"), 700),
        [runAnalysis]
    );

    // For edits (deletion, edit in middle, paste)
    const debouncedEditHandler = useCallback(
        debounce(() => runAnalysis("Edit Handler"), 3000),
        [runAnalysis]
    );

    const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
        // Don't process input events during IME composition
        if (isComposing) {
            return;
        }
  
        const newContent = e.currentTarget.textContent || '';
        setContent(newContent);
        onTextChange?.(newContent);
  
        // Perform Japanese detection after text change
        handleJapaneseDetection(newContent);
  
        // --- Smart Append vs Edit Detection (like legacy) ---
        const textAfter = newContent;
        const textBefore = lastAnalyzedText;
  
        // Text normalization (like legacy)
        const normalizedAfter = normalizeText(textAfter);
        const normalizedBefore = normalizeText(textBefore);
  
        // Decision Logic (like legacy)
        const isAppending = normalizedAfter.length > normalizedBefore.length &&
                           normalizedAfter.startsWith(normalizedBefore);
        const lastChar = textAfter.slice(-1);
        const lastTwoChars = textAfter.slice(-2);
        const isPunctuation = (lastChar === '.' || lastChar === '!' || lastChar === '?') ||
                             ['."', ".'", '!"', "!'", '?"', "?'"].includes(lastTwoChars);
  
        // SCENARIO 1: User is typing a new sentence and just finished it
        if (isAppending && isPunctuation) {
            //console.log("Dispatching to Append Handler (short timer)...");
            debouncedAppendHandler();
        }
        // SCENARIO 2: Any other change (deletion, edit in middle, paste)
        else if (!isAppending) {
            //console.log("Dispatching to Edit Handler (long timer)...");
            debouncedEditHandler();
        }
        // SCENARIO 3: Not punctuation yet - do nothing
  
        // Update cache for the next event
        lastAnalyzedText = textAfter;
    }, [onTextChange, isComposing, handleJapaneseDetection, debouncedAppendHandler,
    debouncedEditHandler]);

    // Handle when IME composition starts
    const handleCompositionStart = useCallback(() => {
        setIsComposing(true);
    }, []);

    // Handle when IME composition ends
    const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLDivElement>) => {
        setIsComposing(false);
        // Process the final composed text
        const newContent = e.currentTarget.textContent || '';
        setContent(newContent);
        onTextChange?.(newContent);

        // Perform Japanese detection after composition ends
        handleJapaneseDetection(newContent);
    }, [onTextChange, handleJapaneseDetection]);

    // Find position of text using DOM Range API
    const findTextPosition = useCallback((text: string, targetEnd = true): { top: number; left: number; containerHeight?: number; bottom?: number } | null => {
        const editor = editorRef.current;
        if (!editor) return null;

        const fullText = editor.textContent || '';
        const textIndex = fullText.indexOf(text);

        if (textIndex === -1) {
            //console.log(`Text "${text}" not found in:`, fullText);
            return null;
        }

        try {
            // Use TreeWalker to find the text node containing our target
            const walker = document.createTreeWalker(
                editor,
                NodeFilter.SHOW_TEXT
            );

            let currentPos = 0;
            let foundNode = null;
            let foundOffset = 0;

            while (walker.nextNode()) {
                const node = walker.currentNode as Text;
                const nodeText = node.textContent || '';
                const nodeLength = nodeText.length;

                if (currentPos + nodeLength > textIndex) {
                    foundNode = node;
                    foundOffset = textIndex - currentPos;
                    break;
                }

                currentPos += nodeLength;
            }

            if (!foundNode) return null;

            // Create range based on whether we want start or end position
            const range = document.createRange();
            if (targetEnd) {
                // Position for button (end of text)
                range.setStart(foundNode, foundOffset + text.length - 1);
                range.setEnd(foundNode, foundOffset + text.length);
            } else {
                // Position for popup (start of text)
                range.setStart(foundNode, foundOffset);
                range.setEnd(foundNode, foundOffset + 1);
            }

            // Get the bounding rectangle
            const rect = range.getBoundingClientRect();

            // Get the container that the buttons are positioned relative to
            const container = editor.closest('.writing-container');
            if (!container) return null;

            const containerRect = container.getBoundingClientRect();

            // Calculate position relative to the writing-container using CSS-only approach
            const basePosition = {
                top: (rect.top - containerRect.top) - 20,  // Move button 20px higher above text
                left: targetEnd
                    ? rect.left - containerRect.left + rect.width  // Button: at end of text
                    : rect.left - containerRect.left,                   // Popup: at start of text
                containerHeight: containerRect.bottom - containerRect.top,
                // Store the text rect for CSS positioning
                textRect: {
                    top: rect.top - containerRect.top,
                    bottom: rect.bottom - containerRect.top,
                    left: rect.left - containerRect.left,
                    right: rect.right - containerRect.left,
                    height: rect.height
                }
            };

            return basePosition;
        } catch (error) {
            console.warn('Could not position text:', text, error);
            return null;
        }
    }, []);

    
    
    // Handle button click for showing popup with suggestion
    const handleButtonClick = useCallback(async (sentence: string) => {

        // Use EXACT same positioning as button (end of sentence)
        const buttonPosition = findTextPosition(sentence, true); // true = targetEnd, SAME AS BUTTON

        // Also get start position for left alignment
        const startPosition = findTextPosition(sentence, false); // false = target start for left position

        if (buttonPosition && startPosition) {
            // Convert button's top position to equivalent bottom positioning
            // const calculatedBottom = (buttonPosition.containerHeight || 0) - buttonPosition.top;

            /*console.log('Popup positioning debug:', {
                sentenceText: sentence,
                buttonTop: buttonPosition.top,
                buttonLeft: buttonPosition.left,      // End of sentence (where button is)
                startLeft: startPosition.left,        // Start of sentence
                containerHeight: buttonPosition.containerHeight,
                calculation: `containerHeight - buttonTop = ${calculatedBottom}`,
                approach: 'Use button positioning but align left to sentence start'
            });*/

            setActivePopup({
                text: sentence, // Store original sentence for replacement
                position: {
                    left: startPosition.left,      // Left aligned to sentence start
                    textRect: {
                        top: startPosition.top || 0,
                        bottom: startPosition.bottom || 0,
                        left: startPosition.left || 0,
                        right: startPosition.left || 0, // Fallback
                        height: 0 // Fallback
                    }
                },
                suggestion: 'Loading...'
            });

            try {
                // Skip manual suggestions in control mode
                if (taskCondition === 'control') {
                    return;
                }

                // Call Convex function to get AI suggestion

                // Log the LLM call for Mixed-Language suggestion
                if (internalUserId) {
                    setCurrentSuggestion({
                        originalText: sentence,
                        category: 'Mixed-Language',
                        timestamp: Date.now()
                    });
                }

                // Extract context - all text before the target sentence
                const fullText = editorRef.current?.textContent || '';
                const sentenceIndex = fullText.indexOf(sentence);
                const context = sentenceIndex > 0 ? fullText.substring(0, sentenceIndex).trim() : '';

                const suggestion = await getSuggestion({
                    target_sentence: sentence,
                    context: context
                });

                // Clean up suggestion text by removing markdown formatting
                const cleanSuggestion = suggestion?.replace(/\*\*(.*?)\*\*/g, '$1') || suggestion;

                // Generate unique tracking ID for this suggestion occurrence
                const trackingId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                // Update popup with the cleaned suggestion first (show immediately)
                setActivePopup(prev => prev ? {
                    ...prev,
                    suggestion: cleanSuggestion ?? undefined,
                    audioUrl: undefined, // Will be set when audio is ready
                    isAudioGenerating: true, // Audio generation in progress,
                    trackingId: trackingId
                } : null);

                // Generate audio in background (non-blocking)
                if (cleanSuggestion) {
                    generateAudioWithTTS(cleanSuggestion).then(audioUrl => {
                        if (audioUrl) {
                            setActivePopup(prev => prev ? {
                                ...prev,
                                audioUrl: audioUrl,
                                isAudioGenerating: false // Audio generation complete
                            } : null);
                        }
                    }).catch(error => {
                        console.error('Background audio generation failed:', error);
                        // Reset loading state on error
                        setActivePopup(prev => prev ? {
                            ...prev,
                            isAudioGenerating: false
                        } : null);
                    });
                }

                // Log the received suggestion as "ignored" when popup opens
                if (cleanSuggestion && internalUserId) {
                    // Log "ignored" action when Japanese popup opens (user will see the suggestion)
                    logSuggestionOnce({
                        userId: internalUserId,
                        trackingId: trackingId,
                        action: 'ignored', // Default to ignored, will be updated to accepted if user clicks suggestion
                        category: 'Mixed-Language',
                        originalText: sentence,
                        suggestedText: cleanSuggestion
                    }).catch(error => {
                        console.error('Failed to log Mixed-Language popup opened:', error);
                    });

                    // Update currentSuggestion with the received suggestion and tracking ID
                    setCurrentSuggestion(prev => prev ? {
                        ...prev,
                        suggestedText: cleanSuggestion,
                        trackingId: trackingId
                    } : null);
                }
            } catch (error) {
                console.error('Error getting suggestion:', error);
                setActivePopup(prev => prev ? {
                    ...prev,
                    suggestion: 'Unable to get suggestion at this time.'
                } : null);
            }
        }

        // Note: Button is now removed immediately in the onClick handler, no need to remove it here
    }, [findTextPosition, getSuggestion, generateAudioWithTTS]);

    // Handle clicks on underlined sentences to show naturalness popup
    const handleTextClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const editor = editorRef.current;
        if (!editor) return;

        const fullText = editor.textContent || '';
        if (!fullText) return;

        // Get the click position
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (!range) return;

        const textNode = range.startContainer;
        if (textNode.nodeType !== Node.TEXT_NODE) return;

        const nodeOffset = range.startOffset;

        // Calculate click position in text
        let currentPosition = 0;
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);

        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            if (node === textNode) {
                currentPosition += nodeOffset;
                break;
            } else {
                currentPosition += node.textContent?.length || 0;
            }
        }

        // Check if click is on any analyzed sentence with LLM suggestions
        Object.entries(analyzedSentences).forEach(([sentence, data]) => {
            if (!data.suggestion) return;

            const sentenceIndex = fullText.indexOf(sentence);
            if (sentenceIndex === -1) return;

            const sentenceEnd = sentenceIndex + sentence.length;

            if (currentPosition >= sentenceIndex && currentPosition <= sentenceEnd) {
                // Find position for the popup (above the start of sentence)
                const position = findTextPosition(sentence, false);

                if (position) {

                    // Log the interaction when user clicks underline to open popup
                    if (internalUserId && data.suggestion) {
                        const trackingId = data.trackingId || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                        // Log suggestion only if trackingId doesn't exist in database
                        logSuggestionOnce({
                            userId: internalUserId,
                            trackingId: trackingId,
                            action: 'ignored', // Default to ignored, will be updated to accepted if user clicks suggestion
                            category: data.category as "Mechanics" | "Naturalness" | "Clarity" | "Mixed-Language",
                            originalText: sentence,
                            suggestedText: data.suggestion,
                            reasonText: data.reason
                        }).catch(error => {
                            console.error('Failed to log naturalness popup opened:', error);
                        });
                    }

                    // Show popup immediately at text level (same as mixed popup initial position)
                    setActiveNaturalnessPopup({
                        sentence: sentence,
                        position: {
                            left: position.left, // Use left positioning
                            textRect: {
                                top: position.top || 0,
                                bottom: position.bottom || 0,
                                left: position.left || 0,
                                right: position.left || 0, // Fallback
                                height: 0 // Fallback
                            }
                        },
                        data: {
                            ...data,
                            audioUrl: undefined, // Will be set when audio is ready
                            isAudioGenerating: true // Audio generation in progress
                        }
                    });

                    // Generate audio in background (non-blocking)
                    if (data.suggestion) {
                        generateAudioWithTTS(data.suggestion).then(audioUrl => {
                            if (audioUrl) {
                                setActiveNaturalnessPopup(prev => prev ? {
                                    ...prev,
                                    data: {
                                        ...prev.data,
                                        audioUrl: audioUrl,
                                        isAudioGenerating: false // Audio generation complete
                                    }
                                } : null);
                            }
                        }).catch(error => {
                            console.error('Background audio generation failed for naturalness popup:', error);
                            // Reset loading state on error
                            setActiveNaturalnessPopup(prev => prev ? {
                                ...prev,
                                data: {
                                    ...prev.data,
                                    isAudioGenerating: false
                                }
                            } : null);
                        });
                    }
                }
            }
        });
    }, [analyzedSentences, findTextPosition, generateAudioWithTTS]);

    // Create floating buttons that appear next to Japanese text
    const createFloatingButtons = useCallback(() => {
        if (excludedButtons.length === 0) return null;

        // Hide buttons in control mode
        if (taskCondition === 'control') return null;

        return excludedButtons.map((button) => {
            const position = findTextPosition(button.text, true); // true = targetEnd for button positioning
            console.log('🔵 Button positioning debug:', {
                buttonText: button.text,
                top: position?.top,
                left: position?.left,
                approach: 'Button uses same positioning as popup (targetEnd=true)'
            });
            return position ? (
                <div
                    key={button.id}
                    style={{
                        position: 'absolute',
                        top: position.top,
                        left: position.left,
                        zIndex: 1000,
                        pointerEvents: 'auto'
                    }}
                >
                    <button
                        onClick={(e) => {
                            //console.log('Button onClick triggered for:', button.text);
                            e.stopPropagation();

                            // Remove the button immediately when clicked
                            setExcludedButtons(prev => prev.filter(b => b.id !== button.id));

                            handleButtonClick(button.text);
                        }}
                        style={{
                            padding: '3px 6px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontSize: '9px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                        }}
                        title={`Get suggestion for: ${button.text}`}
                    >
                        💡
                    </button>
                </div>
            ) : null;
        });
    }, [excludedButtons, handleButtonClick, findTextPosition]);

    // Close popup when clicking outside or pressing Escape
    const closePopup = useCallback(() => {
        setActivePopup(null);
    }, []);

    // Function to replace text in the contentEditable
    const replaceTextInEditor = useCallback((oldText: string, newText: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        const currentContent = editor.textContent || '';

        // Find the exact position of the oldText to ensure we replace the right occurrence
        const textIndex = currentContent.indexOf(oldText);
        if (textIndex === -1) {
            console.warn('Text to replace not found:', oldText);
            return;
        }

        // Replace only the specific occurrence found at textIndex
        const updatedContent = currentContent.substring(0, textIndex) +
                               newText +
                               currentContent.substring(textIndex + oldText.length);

        // Update the editor content
        editor.textContent = updatedContent;

        // Trigger the input handler to update state
        const syntheticEvent = {
            currentTarget: editor,
            target: editor,
        } as unknown as React.FormEvent<HTMLDivElement>;
        handleInput(syntheticEvent);

            }, [handleInput]);

    // Handle clicking on suggestion to replace text
    const handleSuggestionClick = useCallback((originalSentence: string, suggestion: string) => {
        replaceTextInEditor(originalSentence, suggestion);
        closePopup();

        // Update existing suggestion from ignored to accepted for Mixed-Language suggestions
        if (currentSuggestion && currentSuggestion.originalText === originalSentence && internalUserId && currentSuggestion.trackingId) {
            updateSuggestionAction({
                trackingId: currentSuggestion.trackingId,
                newAction: 'accepted'
            }).then(() => {
                //console.log(`Updated Mixed-Language suggestion action: "${originalSentence}" -> "${suggestion}" to accepted [${currentSuggestion.trackingId}]`);
            }).catch(error => {
                console.error('Failed to update suggestion action:', error);
            });
            setCurrentSuggestion(null); // Clear current suggestion
        }
    }, [replaceTextInEditor, closePopup, currentSuggestion, internalUserId, updateSuggestionAction]);

    // Create colored underlines for analyzed sentences
    const createColoredUnderlines = useCallback(() => {
        const underlines: React.ReactElement[] = [];

        Object.entries(analyzedSentences).forEach(([sentence, data]) => {
            const editor = editorRef.current;
            if (!editor) return;

            const fullText = editor.textContent || '';
            if (!fullText.includes(sentence)) return;

            // Find text position for the sentence
            const position = findTextPosition(sentence, false);
            if (!position) return;

            // Get color based on category
            const colors: { [key: string]: string } = {
                "Mechanics": "#ff4444", // Red
                "Naturalness": "#22c55e", // Green
                "Clarity": "#3b82f6" // Blue
            };

            const underlineColor = colors[data.category] || "#ff4444";

            // Create a range to get exact dimensions and handle multi-line text
            try {
                const sentenceIndex = fullText.indexOf(sentence);
                if (sentenceIndex === -1) return;

                const endIndex = sentenceIndex + sentence.length;

                // Create a range for the entire sentence to get its position
                const walker = document.createTreeWalker(
                    editor,
                    NodeFilter.SHOW_TEXT
                );

                let currentPos = 0;
                let startNode = null;
                let startOffset = 0;
                let endNode = null;
                let endOffset = 0;

                // Find start and end nodes for the sentence
                while (walker.nextNode()) {
                    const node = walker.currentNode as Text;
                    const nodeText = node.textContent || '';
                    const nodeLength = nodeText.length;

                    if (currentPos + nodeLength > sentenceIndex && !startNode) {
                        startNode = node;
                        startOffset = sentenceIndex - currentPos;
                    }

                    if (currentPos + nodeLength >= endIndex && !endNode) {
                        endNode = node;
                        endOffset = endIndex - currentPos;
                        break;
                    }

                    currentPos += nodeLength;
                }

                if (startNode && endNode) {
                    // Create ranges for each line of the sentence
                    const range = document.createRange();
                    range.setStart(startNode, startOffset);
                    range.setEnd(endNode, endOffset);

                    const documentPaperRect = documentPaperRef.current?.getBoundingClientRect();
                    if (!documentPaperRect) return;

                    // Get all text rectangles (handles multi-line)
                    const rects = range.getClientRects();
                    const rectArray = Array.from(rects);

                    // Create underlines for each line
                    rectArray.forEach((rect: DOMRect, index: number) => {
                        if (rect.width > 0 && rect.height > 0) {
                            underlines.push(
                                <div
                                    key={`underline-${sentence.replace(/\s+/g, '-')}-${data.category}-${index}`}
                                    style={{
                                        position: 'absolute',
                                        top: rect.bottom - documentPaperRect.top + 2,
                                        left: rect.left - documentPaperRect.left,
                                        width: rect.width,
                                        height: '2px',
                                        backgroundColor: underlineColor,
                                        zIndex: 999,
                                        pointerEvents: 'none',
                                        borderRadius: '1px',
                                        transition: 'opacity 0.2s ease'
                                    }}
                                />
                            );
                        }
                    });

                    // Debug logging
                                    }
            } catch (error) {
                console.warn('Could not create underline for:', sentence, error);
            }
        });

        return underlines;
    }, [analyzedSentences, findTextPosition]);

    // Handle clicking on naturalness suggestion to replace text
    const handleNaturalnessSuggestionClick = useCallback((originalSentence: string, suggestion: string) => {
        replaceTextInEditor(originalSentence, suggestion);
        setActiveNaturalnessPopup(null); // Close the naturalness popup

        // Track evolution: Find the original sentence and create evolved version
        const originalSentenceObj = findSentenceByText(naturalnessCheckedSentences, originalSentence);
        if (originalSentenceObj) {
            // Create evolved sentence with new version
            const evolvedSentence = evolveSentence(originalSentenceObj, suggestion);

            // Remove from naturalnessCheckedSentences and add to englishSentences
            const index = naturalnessCheckedSentences.findIndex(s => s.text === originalSentence);
            if (index !== -1) {
                naturalnessCheckedSentences.splice(index, 1);
                englishSentences.push(evolvedSentence);
                            }
        } else {
            console.warn('Could not find original sentence for evolution tracking:', originalSentence);
        }

        // Update the suggestion from "ignored" to "accepted"
        if (internalUserId) {
            // Get tracking ID from analyzedSentences
            const trackingId = analyzedSentences[originalSentence]?.trackingId;

            if (trackingId) {
                updateSuggestionAction({
                    trackingId: trackingId,
                    newAction: 'accepted'
                }).then(() => {
                                    }).catch(error => {
                    console.error('Failed to update naturalness suggestion to accepted:', error);
                });
            } else {
                //console.log('Missing trackingId for naturalness suggestion update');
            }
        }
    }, [replaceTextInEditor, internalUserId, updateSuggestionAction, analyzedSentences]);

    
    // Create naturalness popup component
    const createNaturalnessPopup = useCallback(() => {
        if (!activeNaturalnessPopup) return null;

        const categoryEmoji: { [key: string]: string } = {
            "Mechanics": "🔧",
            "Naturalness": "💡",
            "Clarity": "🔍"
        };

        const emoji = categoryEmoji[activeNaturalnessPopup.data.category] || "📝";

        // Get color based on category
        const colors: { [key: string]: string } = {
            "Mechanics": "#ffadbb", // light pink
            "Naturalness": "#22c55e", // Green
            "Clarity": "#90b3ee" // Blue
        };

        const popupColor = colors[activeNaturalnessPopup.data.category] || "#ff4444";

        return (
            // === POPUP POSITIONING ===
            // CSS-based positioning for consistency across environments
            <div
                style={{
                    position: 'absolute',
                    // Position at the text location, then use CSS transform to offset
                    top: activeNaturalnessPopup.position.textRect?.top || 0,
                    left: activeNaturalnessPopup.position.left,
                    transform: 'translateY(-100%) translateY(+10px)', 
                    transformOrigin: 'top left',
                    zIndex: 1001,
                    pointerEvents: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    style={{
                        // === MAIN CONTAINER STYLES ===
                        // Overall popup appearance and size
                        backgroundColor: popupColor,
                        border: popupColor,
                        borderRadius: '12px',           // 8px Corner roundness
                        padding: '8px 16px',          // Internal spacing
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)', // Drop shadow
                        fontSize: '12px',             // Text size inside popup
                        minWidth: '250px',
                        maxWidth: '800px',
                        position: 'relative'
                    }}
                >
                    {/* === POPUP ARROW === */}
                    {/* Triangle pointing down to the text */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-8px',                    // Distance from popup bottom
                            left: '20px',                      // Horizontal position
                            width: '0',
                            height: '0',
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderTop: popupColor       // Arrow border color
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-7px',                    // Slightly higher than shadow
                            left: '20px',
                            width: '0',
                            height: '0',
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderTop: `8px solid ${popupColor}` // Arrow fill color
                        }}
                    />

                    <div>
                        {/* === HEADER SECTION === */}
                        {/* Title with emoji and category */}
                        <div style={{
                            display: 'flex',                   // Layout direction
                            alignItems: 'center',              // Vertical alignment
                            justifyContent: 'space-between',   // Space between title and close button
                            marginBottom: '8px',               // Space below header
                            fontWeight: 'bold',                // Bold text
                            color: '#000'//'#fff'                      // White text color
                        }}>
                            <div style={{
                                display: 'flex',               // Flex for title content
                                alignItems: 'center',          // Vertical alignment
                                gap: '8px'                     // Space between emoji and text
                            }}>
                                <span style={{ fontSize: 14 }}>{emoji}</span>                {/*Emoji size*/}
                                <span style={{ fontSize: 12 }}>{activeNaturalnessPopup.data.category} Issue</span> {/*Header text size*/}
                            </div>

                            {/* === CLOSE BUTTON === */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();  // Prevent popup from closing immediately

                                    // Remove suggestion from analyzed sentences
                                    setAnalyzedSentences(prev => {
                                        const newSentences = {...prev};
                                        delete newSentences[activeNaturalnessPopup.sentence];
                                        return newSentences;
                                    });

                                    // Mark sentence as rejected in global tracking to prevent re-analysis
                                    const sentenceToReject = activeNaturalnessPopup.sentence;

                                    // Find and mark as rejected in naturalnessCheckedSentences
                                    const checkedSentence = naturalnessCheckedSentences.find(s => s.text === sentenceToReject);
                                    if (checkedSentence) {
                                        checkedSentence.rejected = true;
                                    }

                                    // Find and mark as rejected in englishSentences
                                    const englishSentence = englishSentences.find(s => s.text === sentenceToReject);
                                    if (englishSentence) {
                                        englishSentence.rejected = true;
                                    }

                                    setActiveNaturalnessPopup(null);  // Close the popup
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#000',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    padding: '1px',
                                    borderRadius: '50%',
                                    width: '18px',
                                    height: '18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background-color 0.2s ease'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="Close popup"
                            >
                                ×
                            </button>
                        </div>

                        {/* === SUGGESTION SECTION === */}
                        <div style={{
                            marginBottom: '6px',               // Space below section
                            color: '#000',                     // # fff Text color
                            fontSize: 20                      // Section text size
                        }}>
                            {/* <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Suggestion:</div> Section label */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <button
                                    onClick={() => {
                                        if (activeNaturalnessPopup.data.audioUrl) {
                                            // Use pre-generated audio if available
                                            playAudioFromUrl(activeNaturalnessPopup.data.audioUrl, activeNaturalnessPopup.data.trackingId);
                                        } else if (activeNaturalnessPopup.data.isAudioGenerating) {
                                            // Audio is still generating, don't do anything
                                            return;
                                        } else {
                                            // No audio available and not generating
                                            return;
                                        }
                                    }}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: '1px solid transparent',
                                        borderRadius: '50%',
                                        width: '24px',
                                        height: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: activeNaturalnessPopup.data.audioUrl ? 'pointer' : 'not-allowed',
                                        transition: 'background-color 0.2s ease',
                                        color: '#000',
                                        fontSize: '14px',
                                        flexShrink: 0,
                                        outline: 'none',
                                        opacity: activeNaturalnessPopup.data.isAudioGenerating ? 0.5 : 1
                                    }}
                                    onMouseEnter={(e) => {
                                        if (activeNaturalnessPopup.data.audioUrl) {
                                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                                            e.currentTarget.style.border = '1px solid transparent';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                    title={activeNaturalnessPopup.data.isAudioGenerating ? "Generating audio..." : "Play suggested text"}
                                >
                                    {activeNaturalnessPopup.data.isAudioGenerating ? '⏳' : '▶️'}
                                </button>
                                <div
                                    style={{
                                        // === SUGGESTION BOX STYLES ===
                                        // Clickable box with the suggested text
                                        backgroundColor: 'rgba(255, 255, 255, 0.2)',  // Semi-transparent background
                                        padding: '4px 12px',                        // Internal spacing
                                        borderRadius: '15px',                       // Corner roundness
                                        cursor: 'pointer',                          // Hand cursor on hover
                                        transition: 'background-color 0.2s ease',  // Smooth hover effect
                                        border: '1px solid rgba(255, 255, 255, 0.3)', // Border
                                        flex: 1
                                    }}
                                    onClick={() => handleNaturalnessSuggestionClick(activeNaturalnessPopup.sentence, activeNaturalnessPopup.data.suggestion)}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';  // Hover background
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';  // Normal background
                                    }}
                                >
                                    {activeNaturalnessPopup.data.suggestion}  {/*/ The suggested text*/}
                                </div>
                            </div>
                        </div>

                        {/* === REASON SECTION === */}
                        <div style={{
                            color: '#000',//'rgba(255, 255, 255, 0.9)',    // Slightly transparent text
                            fontSize: 16,                           // Smaller text size
                            fontStyle: 'italic',                    // Italic style
                            marginBottom: '6px'                     // Space below
                        }}>
                            {activeNaturalnessPopup.data.reason}    {/* Why the change is suggested*/}
                        </div>

                        {/* === FOOTER SECTION === */}
                        {/* <div style={{
                            textAlign: 'center',                   // Center alignment
                            color: 'rgba(255, 255, 255, 0.8)',    // More transparent text
                            fontSize: '11px',                      // Even smaller text
                            fontStyle: 'italic'
                        }}>
                            Click suggestion to replace
                        </div> */}
                    </div>
                </div>
            </div>
        );
    }, [activeNaturalnessPopup, handleNaturalnessSuggestionClick]);

    // Create popup component
    const createPopup = useCallback(() => {
        if (!activePopup) {
            return null;
        }

        return (
            // === JAPANESE SUGGESTION POPUP POSITIONING ===
            // CSS-based positioning for consistency across environments
            <div
                style={{
                    position: 'absolute',
                    // Position at the text location, then use CSS transform to offset
                    top: activePopup.position.textRect?.top || 0,
                    left: activePopup.position.left,
                    transform: 'translateY(-100%) translateY(+10px)', // Position 25px above text
                    transformOrigin: 'top left',
                    zIndex: 1001,
                    pointerEvents: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    style={{
                        // === JAPANESE POPUP MAIN CONTAINER ===
                        // Overall appearance for Japanese text suggestions
                        backgroundColor: '#003399',          // Dark blue background
                        border: '1px solid #003399',           // Border
                        borderRadius: '12px',               // Very rounded corners (pill shape)
                        padding: '4px 2px',                // Internal spacing
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)', // Drop shadow
                        fontSize: '12px',                   // Text size
                        minWidth: '250px',                  // Minimum width
                        maxWidth: '600px',                  // Maximum width
                        minHeight: '10px',                  // Minimum height
                        position: 'relative'
                    }}
                >
                    {/* === JAPANESE POPUP ARROW === */}
                    {/* Triangle pointing down to the Japanese text */}
                    <div
                        style={{
                            color: '#003399',               // Arrow color (matches background)
                            position: 'absolute',
                            bottom: '-8px',
                            left: '20px',
                            width: '0',
                            height: '0',
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderTop: '8px solid #003399',
                            transform: 'translateY(0)' // Ensure arrow positioning is consistent
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-7px',
                            left: '20px',
                            width: '0',
                            height: '0',
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderTop: '8px solid #003399'
                        }}
                    />

                    <div>
                    {/* === JAPANESE POPUP HEADER === */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',  // Space between suggestion and close button
                        gap: '12px',
                        marginBottom: '0px'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            flex: 1
                        }}>
                            <button
                                onClick={() => {
                                    if (activePopup.audioUrl) {
                                        // Use pre-generated audio if available
                                        playAudioFromUrl(activePopup.audioUrl, activePopup.trackingId);
                                    } else if (activePopup.isAudioGenerating || activePopup.suggestion === 'Loading...') {
                                        // Audio is still generating or suggestion is loading, don't do anything
                                        return;
                                    } else {
                                        // No audio available and not generating
                                        return;
                                    }
                                }}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid transparent',
                                    borderRadius: '50%',
                                    width: '24px',
                                    height: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: activePopup.audioUrl ? 'pointer' : 'not-allowed',
                                    transition: 'background-color 0.2s ease',
                                    color: '#fff',
                                    fontSize: '16px',
                                    outline: 'none',
                                    opacity: (activePopup.isAudioGenerating || activePopup.suggestion === 'Loading...') ? 0.5 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (activePopup.audioUrl) {
                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                                        e.currentTarget.style.border = '1px solid transparent';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title={
                                    activePopup.isAudioGenerating ? "Generating audio..." :
                                    activePopup.suggestion === 'Loading...' ? "Loading suggestion..." :
                                    "Play suggested text"
                                }
                            >
                                {
                                    activePopup.isAudioGenerating ? '⏳' :
                                    activePopup.suggestion === 'Loading...' ? '⏳' :
                                    '▶️'
                                }
                            </button>
                            <span
                                style={{
                                    color: '#FFF',
                                    flex: 1,
                                    fontSize: 24,
                                    cursor: 'pointer',
                                    padding: '4px 14px',
                                    borderRadius: '15px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    transition: 'background-color 0.2s ease',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    textAlign: 'left'
                                }}
                                onClick={() => handleSuggestionClick(activePopup.text, activePopup.suggestion || '')}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                                }}
                                title="Click to replace the text"
                            >
                                {activePopup.suggestion || 'sample'}
                            </span>
                        </div>

                        {/* === JAPANESE POPUP CLOSE BUTTON === */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();  // Prevent popup from closing immediately

                                // Log ignored action before dismissing
                                                                setCurrentSuggestion(null); // Clear current suggestion

                                // Remove suggestion button from excluded buttons
                                setExcludedButtons(prev =>
                                    prev.filter(button => button.text !== activePopup.text)
                                );

                                // Note: Mixed-language sentences don't use global variables tracking
                                // (englishSentences/naturalnessCheckedSentences), so no additional cleanup needed

                                closePopup();  // Close the popup
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#fff',                   // White text (matches popup)
                                fontSize: '14px',
                                cursor: 'pointer',
                                padding: '1px',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s ease'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            title="Close popup"
                        >
                            ×
                        </button>
                    </div>
                    {/* <div style={{
                        textAlign: 'center',
                        color: 'rgba(255, 255, 255, 0.8)',
                        fontSize: '12px',
                        fontStyle: 'italic'
                    }}>
                        Click the suggestion to replace your text
                        フレーズをクリックで適用
                    </div> */}
                </div>
                </div>
            </div>
        );
    }, [activePopup, closePopup, handleSuggestionClick]);

    return (
        <div className="writing-container">
            <div className="document-viewport" style={{ marginTop: '200px' }}>
                <div className="document-paper" ref={documentPaperRef} style={{ position: 'relative' }}>
                    <div
                        ref={editorRef}
                        contentEditable
                        className="document-content"
                        onInput={handleInput}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                        onClick={handleTextClick}
                        suppressContentEditableWarning={true}
                        spellCheck={false}
                        data-placeholder={content.length === 0 ? placeholder : undefined}
                    />
                    {/* Colored underlines for analyzed sentences */}
                    {createColoredUnderlines()}
                </div>

                {/* Submit Button within document viewport */}
                <div style={{
                    marginTop: '2rem',
                    textAlign: 'center',
                    padding: '1rem'
                }}>
                    <button
                        onClick={async () => {
                            
                            if (!currentTaskId) {
                                console.error('No task ID available');
                                return;
                            }

                            try {
                                await submitTask({
                                    taskId: currentTaskId,
                                    finalText: content
                                });
                                                                alert('提出完了です！お疲れ様でした！');
                            } catch (error) {
                                console.error('Failed to submit task:', error);
                                alert('Failed to submit. Please try again.');
                            }
                        }}
                        disabled={!content.trim()}
                        style={{
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            padding: '0.75rem 2rem',
                            borderRadius: '4px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#218838';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#28a745';
                        }}
                    >
                        Submit
                    </button>
                </div>
            </div>

            {/* Floating buttons positioned relative to the document */}
            {createFloatingButtons()}

            {/* Naturalness popup for analyzed sentences */}
            {createNaturalnessPopup()}

            {/* Popup for suggestions */}
            {createPopup()}
        </div>
    );
}
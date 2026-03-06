import WritingArea from './components/WritingArea';
import AuthPage from './components/AuthPage';
import TaskSelection from './components/TaskSelection';
import { useState } from 'react';
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState('');
  const [taskCondition, setTaskCondition] = useState<'control' | 'experimental' | null>(null);
  const [internalUserId, setInternalUserId] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  const handleLogin = async (userUserId: string) => {
    try {
      // Convexの代わりに、自作したGoのAPIへPOSTリクエストを送る
      const response = await fetch("http://localhost:8080/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ externalUserId: userUserId }),
      });

      if (!response.ok) {
        throw new Error(`API error! status: ${response.status}`);
      }

      // Goから返ってきたJSONを受け取る
      const data = await response.json();
      const internalId = data.id;

      setInternalUserId(internalId);
      setUserId(userUserId);
      setIsAuthenticated(true);
      console.log(`User ${userUserId} created with internal ID (Go): ${internalId}`);
    } catch (error) {
      console.error('Failed to create/find user via Go API:', error);
    }
  };

  const handleTaskSelected = async (condition: 'control' | 'experimental') => {
    if (!internalUserId) return;

    try {
      // Goのタスク作成APIへリクエストを送信
      const response = await fetch("http://localhost:8080/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: internalUserId, // 取得したユーザーのUUID
          condition: condition    // 'control' か 'experimental'
        }),
      });

      if (!response.ok) {
        throw new Error(`API error! status: ${response.status}`);
      }

      // Goから返ってきたタスクのUUIDを受け取る
      const data = await response.json();
      const taskId = data.id;

      setTaskCondition(condition);
      setCurrentTaskId(taskId);
      console.log(`Task created with internal ID (Go): ${taskId} for condition: ${condition}`);
    } catch (error) {
      console.error('Failed to create task via Go API:', error);
    }
  };

  const handleTextChange = (_text: string) => {
    // This is where text analysis will be added later
  };

  const handleJapaneseDetection = (hasJapanese: boolean) => {
    console.log('Japanese detected:', hasJapanese);
  };

  const handleBackToTasks = () => {
    setTaskCondition(null);
    setCurrentTaskId(null);
  };

  if (!isAuthenticated) {
    return <AuthPage onLogin={handleLogin} />;
  }

  if (!taskCondition) {
    return <TaskSelection onTaskSelected={handleTaskSelected} userId={userId} />;
  }

  return (
    <div className="App">
      <header style={{
        backgroundColor: '#f8f9fa',
        padding: '1rem 2rem',
        borderBottom: '1px solid #dee2e6',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{
            margin: 0,
            color: '#333',
            fontSize: '24px',
            fontWeight: 'bold'
          }}>
            rephraseFB
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '14px' }}>
            User: {userId} • Task: {taskCondition === 'control' ? 'Control' : 'Experimental'}
          </p>
        </div>
        <button
          onClick={handleBackToTasks}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s ease'
          }}
        >
          ← Back to Tasks
        </button>
      </header>

      <main>
        <WritingArea
          placeholder="Begin writing your English text here..."
          onTextChange={handleTextChange}
          onJapaneseDetected={handleJapaneseDetection}
          userId={userId}
          taskCondition={taskCondition}
          internalUserId={internalUserId as any} // WritingArea側がConvexのId型を期待しているため一時的にany
          currentTaskId={currentTaskId as any}
        />
      </main>
    </div>
  )
}

export default App
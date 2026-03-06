import React, { useState } from 'react';

interface TaskSelectionProps {
  onTaskSelected: (taskCondition: 'control' | 'experimental') => void;
  userId: string;
}

const TaskSelection: React.FC<TaskSelectionProps> = ({ onTaskSelected}) => {
  const [selectedTask, setSelectedTask] = useState<'control' | 'experimental' | null>(null);

  const handleStartTask = () => {
    if (selectedTask) {
      onTaskSelected(selectedTask);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '500px',
        textAlign: 'center'
      }}>
        <h2 style={{
          margin: '0 0 1rem 0',
          color: '#333'
        }}>
          {/* Select Task Condition */}
          タスクを選択

        </h2>

        <p style={{
          margin: '0 0 2rem 0',
          color: '#666',
          fontSize: '16px',
          lineHeight: '1.5'
        }}>
          {/* Welcome <strong>User {userId}</strong>! Please select a task condition to begin your writing session. */}
          ようこそ！ライティングのタスクを選択してね！
        </p>

        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <button
            onClick={() => setSelectedTask('control')}
            style={{
              flex: 1,
              padding: '1.5rem',
              border: selectedTask === 'control' ? '2px solid #007bff' : '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: selectedTask === 'control' ? '#e3f2fd' : 'white',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (selectedTask !== 'control') {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTask !== 'control') {
                e.currentTarget.style.backgroundColor = 'white';
              }
            }}
          >
            <div style={{
              fontSize: '20px',
              fontWeight: 'bold',
              marginBottom: '0.5rem',
              color: '#007bff'
            }}>
              Task 1
            </div>
            <div style={{
              fontSize: '16px',
              color: '#666'
            }}>
              支援アシスタントなし
            </div>
          </button>

          <button
            onClick={() => setSelectedTask('experimental')}
            style={{
              flex: 1,
              padding: '1.5rem',
              border: selectedTask === 'experimental' ? '2px solid #28a745' : '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: selectedTask === 'experimental' ? '#e8f5e8' : 'white',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (selectedTask !== 'experimental') {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTask !== 'experimental') {
                e.currentTarget.style.backgroundColor = 'white';
              }
            }}
          >
            <div style={{
              fontSize: '20px',
              fontWeight: 'bold',
              marginBottom: '0.5rem',
              color: '#28a745'
            }}>
              Task 2
            </div>
            <div style={{
              fontSize: '16px',
              color: '#666'
            }}>
              支援アシスタントあり
            </div>
          </button>
        </div>

        <button
          onClick={handleStartTask}
          disabled={!selectedTask}
          style={{
            backgroundColor: selectedTask ? '#28a745' : '#6c757d',
            color: 'white',
            border: 'none',
            padding: '0.75rem 2rem',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: selectedTask ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.2s ease',
            width: '100%'
          }}
          onMouseEnter={(e) => {
            if (selectedTask) {
              e.currentTarget.style.backgroundColor = '#218838';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedTask) {
              e.currentTarget.style.backgroundColor = '#28a745';
            }
          }}
        >
          Start Writing
        </button>

        {/* <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#6c757d',
          fontStyle: 'italic'
        }}>
          <strong>Research Information:</strong> Your writing data will be collected for research purposes. You can complete both task conditions if you'd like to participate more extensively.
        </div> */}
      </div>
    </div>
  );
};

export default TaskSelection;
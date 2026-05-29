import { useState, useEffect } from 'react'
import './App.css'

interface ApiResponse {
  success: boolean
  data: {
    events: any[]
    message: string
  }
}

function App() {
  const [apiStatus, setApiStatus] = useState<string>('测试中...')
  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    testApiConnection()
  }, [])

  const testApiConnection = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/test')
      const data: ApiResponse = await response.json()
      if (data.success) {
        setApiStatus('API连接正常')
        setEvents(data.data.events)
      } else {
        setApiStatus('API连接失败')
      }
    } catch (error) {
      setApiStatus('无法连接到后端服务')
      console.error('API Error:', error)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>语音日历工具</h1>
        <p>Voice Calendar Tool</p>
      </header>

      <main className="app-main">
        <section className="status-section">
          <h2>系统状态</h2>
          <div className="status-card">
            <p>后端API状态: <span className={apiStatus === 'API连接正常' ? 'status-ok' : 'status-error'}>{apiStatus}</span></p>
            <button onClick={testApiConnection} className="btn btn-primary">
              重新测试连接
            </button>
          </div>
        </section>

        <section className="events-section">
          <h2>日历事件</h2>
          {events.length === 0 ? (
            <p className="no-events">暂无事件</p>
          ) : (
            <div className="events-list">
              {events.map((event, index) => (
                <div key={index} className="event-card">
                  <p>{event.title}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="voice-section">
          <h2>语音控制</h2>
          <div className="voice-controls">
            <button className="btn btn-voice">
              开始语音输入
            </button>
            <p className="voice-hint">点击按钮开始语音输入</p>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>语音日历工具 v0.1.0</p>
      </footer>
    </div>
  )
}

export default App

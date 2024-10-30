import { useState } from 'react'
import './index.css'
import SignLanguageConversation from './components/sign'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <SignLanguageConversation />
    </>
  )
}

export default App

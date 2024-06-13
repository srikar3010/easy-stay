import React, { useState } from 'react'
import { Link,useNavigate } from 'react-router-dom'
import axios from 'axios'
function Register() {
  let navigate=useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function registerUser(ev){
    ev.preventDefault()
    const res = await axios.post('/register',{
      name,
      email,
      password
    })
    if(res.data.message==='user created'){
      navigate('/login')
    }
    else{
      alert(res.data.message)
    }
  }

  return (
    <div className='mt-4 grow flex items-center justify-around'>
      <div className='mb-64'>
        <h1 className='text-4xl text-center mb-4'>Register</h1>
        <form className='max-w-md mx-auto' onSubmit={registerUser}>
          <input type="text" placeholder='Name'
            value={name}
            onChange={ev => setName(ev.target.value)} />
          <input type="email" placeholder='example@gmail.com'
            value={email}
            onChange={ev => setEmail(ev.target.value)} />
          <input type="password" placeholder='password'
            value={password}
            onChange={ev => setPassword(ev.target.value)} />
          <button className='primary'>Register</button>
          <div className='text-center py-2 text-gray-500'>
            Already a member? <Link className='underline text-black' to={'/login'}>Login</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Register
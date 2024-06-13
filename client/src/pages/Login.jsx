import React, { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../UserContext'
function Login() {
  let navigate = useNavigate()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const {setUser}=useContext(UserContext)
  async function handleLoginSubmit(ev){
    ev.preventDefault()
    const res = await axios.post('/login',{
      email,
      password
    })
    if(res.data.message==='login success'){
      setUser(res.data.user)
      navigate('/')
    }
    else{
      alert(res.data.message)
    }
  }

  return (
    <div className='mt-4 grow flex items-center justify-around'>
      <div className='mb-64'>
        <h1 className='text-4xl text-center mb-4'>Login</h1>
        <form className='max-w-md mx-auto' onSubmit={handleLoginSubmit}>
          <input type="email" placeholder='example@gmail.com' value={email} onChange={ev=> setEmail(ev.target.value)}/>
          <input type="password" placeholder='password' value={password} onChange={ev=> setPassword(ev.target.value)} />
          <button className='primary'>Login</button>
          <div className='text-center py-2 text-gray-500'>
            Don't have an account? <Link className='underline text-black' to='/register'>Register now</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login
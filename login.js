 // Import the loginUser function and get references to the login form elements
 import { loginUser } from "./apiservice.js";

const emailInput=document.getElementById("email");
const passwordInput=document.getElementById("password");
const loginBtn=document.getElementById("Log-in-btn");
const loginMessage=document.getElementById("login-message");


// async function render(){
//     let read=await fetch("http://localhost:3000/users");
//     console.log('rea=', read);
// }


// Handle login, verify the user's credentials, and redirect to the dashboard
loginBtn.addEventListener("click",async function(){

const email=emailInput.value.trim();
const password= passwordInput.value;

const user= await loginUser(email,password);

  if(user){
    console.log("login successful");
    window.location.href="dashboard.html";
  }else{
    loginMessage.textContent="Email or password is incorrect";
    
  }

});
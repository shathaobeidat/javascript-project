  import { registerUser } from "./apiservice.js";// Import the registerUser function from the API service

  // Get references to the signup form elements
  const userName=document.getElementById("name");
  const emailInput=document.getElementById("email");
  const passwordInput=document.getElementById("password");
  const confarmPassword=document.getElementById("confarm");
  const signupForm = document.getElementById("signup-form");
  const signupMessage = document.getElementById("signup-message");
 
 //Get references to the password validation messages
  const lengthNumber=document.getElementById("leangh-number");
  const Uppercas=document.getElementById("uppercas");
  const lawerCase=document.getElementById("lawercase");
  const oneNumber=document.getElementById("one-number");

// Handle signup form submission, validate passwords, and register the new user
 signupForm.addEventListener("submit", async function(event) {
    event.preventDefault();
 
   const name=userName.value.trim();
   const email=emailInput.value.trim();
   const password= passwordInput.value;
   const confarmpass=confarmPassword.value;

if (password !== confarmpass) {
    signupMessage.textContent="Passwords do not match";
   
}

    try{

    const user= await registerUser ({name: name, email: email, password: password
    });

    if (user) {
        window.location.href = "login.html";
    }
  }
    catch(error){
     signupMessage.textContent= error.message;


    }
  });

// Validate password requirements in real time while the user is typing
  passwordInput.addEventListener("input",function(){

   const password=passwordInput.value;
  
  if(password.length >= 8){
      lengthNumber.textContent="✅ At least 8 character";
  }
   else{
      lengthNumber.textContent=" ❌ At least 8 character";
  }
   
  if(/[A-Z]/.test(password)){
      Uppercas.textContent="  ✅one  character  capital";
  }
  else{
      Uppercas.textContent=" ❌ At least 8 character";
  }

  if(/[a-z]/.test(password)){
      lawerCase.textContent="  ✅one  character  small";
  }
  else{
      lawerCase.textContent=" ❌ one  character  small";
  }
  if(/[0-9]/.test(password)){
      oneNumber.textContent="  ✅one  number At least";
  }
  else{
      oneNumber.textContent=" ❌ one  number At least";
  }

});
const auth = firebase.auth()




const auth_firebase = (ns_prefix) => {

  const send_token_to_shiny = (user) => {
    return user.getIdToken(true).then(firebase_token => {

      const polished_cookie = "p" + Math.random()


      Cookies.set(
        'polished',
        polished_cookie,
        { expires: 365 } // set cookie to expire in 1 year
      )

      Shiny.setInputValue(`${ns_prefix}check_jwt`, {
        jwt: firebase_token,
        cookie: polished_cookie
      }, {
        event: "priority"
      });
    })
  }


  const sign_in = (email, password) => {

    return auth.signInWithEmailAndPassword(email, password).then(user_object => {

      return send_token_to_shiny(user_object.user)

    })
  }

  $(document).on("click", `#${ns_prefix}submit_register`, () => {
    const email = $(`#${ns_prefix}email`).val().toLowerCase()
    const password = $(`#${ns_prefix}register_password`).val()
    const password_2 = $(`#${ns_prefix}register_password_verify`).val()

    if (password !== password_2) {
      // Event to reset Register loading button from loading state back to ready state
      loadingButtons.resetLoading(`${ns_prefix}submit_register`);

      toastr.error("The passwords do not match", null, toast_options)
      console.log("the passwords do not match")

      return
    }

    auth.createUserWithEmailAndPassword(email, password).then((userCredential) => {

      // send verification email
      return userCredential.user.sendEmailVerification().catch(error => {
        console.error("Error sending email verification", error)
        loadingButtons.resetLoading(`${ns_prefix}submit_register`);
      })


    }).then(() => {

      return sign_in(email, password).catch(error => {
        toastr.error(`Sign in Error: ${error.message}`, null, toast_options)
        console.log("error: ", error)
        loadingButtons.resetLoading(`${ns_prefix}submit_sign_in`);
      })

    }).catch((error) => {
      toastr.error("" + error, null, toast_options)
      console.log("error registering user")
      console.log(error)
      loadingButtons.resetLoading(`${ns_prefix}submit_register`);
    })

  })


  $(document).on("click", `#${ns_prefix}reset_password`, () => {
    const email = $(`#${ns_prefix}email`).val().toLowerCase()

    auth.sendPasswordResetEmail(email).then(() => {
      console.log(`Password reset email sent to ${email}`)
      toastr.success(`Password reset email sent to ${email}`, null, toast_options)
    }).catch((error) => {
      toastr.error("" + error, null, toast_options)
      console.log("error resetting email: ", error)
    })
  })

  $(document).on("click", `#${ns_prefix}submit_sign_in`, () => {

    const email = $(`#${ns_prefix}email`).val().toLowerCase()
    const password = $(`#${ns_prefix}password`).val()

    sign_in(email, password).catch(error => {

      // Event to reset Sign In loading button
      loadingButtons.resetLoading(`${ns_prefix}submit_sign_in`);
      toastr.error(`Sign in Error: ${error.message}`, null, toast_options)
      console.log("error: ", error)
    })

  })
  
  // Multi-factor authentication w/ Email & Phone
  // 1) Set up reCAPTCHA verifier
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(`${ns_prefix}submit_sign_in`, {
    'size': 'invisible',
    'callback': function(response) {
      // reCAPTCHA solved, you can proceed with phoneAuthProvider.verifyPhoneNumber(...).
        // Need to show modal where user enters phone number 
      onSolvedRecaptcha();
    }
  });
  
  // 2) Enroll 2nd factor (e.g. Phone)
  var appVerifier = new firebase.auth.RecaptchaVerifier(container);
    user.multiFactor.getSession().then(function(multiFactorSession) {
      // Specify the phone number and pass the MFA session.
      var phoneInfoOptions = {
        phoneNumber: phoneNumber,
        session: multiFactorSession
      };
      var phoneAuthProvider = new firebase.auth.PhoneAuthProvider();
      // Send SMS verification code.
      return phoneAuthProvider.verifyPhoneNumber(
          phoneInfoOptions, appVerifier);
    })
    .then(function(verificationId) {
      // Ask user for the verification code.
      var cred = firebase.auth.PhoneAuthProvider.credential(verificationId, verificationCode);
      var multiFactorAssertion = firebase.auth.PhoneMultiFactorGenerator.assertion(cred);
      // Complete enrollment.
      return user.multiFactor.enroll(multiFactorAssertion, mfaDisplayName);
  });
  
  // Reference: https://cloud.google.com/identity-platform/docs/web/mfa#enrolling_a_second_factor
  // Options:
  //    1) Register w/ 2nd factor
  //      - Offer option to register w/ 2nd factor
  //      - Offer optoin to add 2nd factor later on (in-app)
  //    2) Sign-in w/ 2nd factor 
  

  $(document).on("shiny:sessioninitialized", () => {
    // check if the email address is already register
    Shiny.addCustomMessageHandler(
      `${ns_prefix}check_registered`,
      (message) => {

        auth.fetchSignInMethodsForEmail(message.email).then(res => {

          let is_registered = false
          if (res.length > 0) {
            is_registered = true
          }

          Shiny.setInputValue(`${ns_prefix}check_registered_res`, is_registered, { priority: "event" })

        }).catch(err => {

          Shiny.setInputValue(`${ns_prefix}check_registered_res`, err, { priority: "event" })
          console.log("error: ", err)

        })

      }
    )

  })


  // Google Sign In
  const provider_google = new firebase.auth.GoogleAuthProvider();

  $(document).on("click", `#${ns_prefix}sign_in_with_google`, () => {
    auth.signInWithPopup(provider_google).then(function(result) {

      return send_token_to_shiny(result.user)
    }).catch(function(err) {

      console.log(error)

      toastr.error(`Sign in Error: ${err.message}`, null, toast_options)
    })
  })

  // Microsoft Sign In
  var provider_microsoft = new firebase.auth.OAuthProvider('microsoft.com');
  $(document).on("click", `#${ns_prefix}sign_in_with_microsoft`, () => {
    auth.signInWithPopup(provider_microsoft).then(function(result) {

      return send_token_to_shiny(result.user)
    }).catch(err => {

      console.log(err)

      toastr.error(`Sign in Error: ${err.message}`, null, toast_options)
    })
  })

  // Facebook Sign In
  var provider_facebook = new firebase.auth.FacebookAuthProvider();
  $(document).on("click", `#${ns_prefix}sign_in_with_facebook`, () => {
    auth.signInWithPopup(provider_facebook).then(function(result) {

      return send_token_to_shiny(result.user)
    }).catch(err => {

      console.log(err)

      toastr.error(`Sign in Error: ${err.message}`, null, toast_options)
    })
  })

}


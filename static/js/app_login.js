const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const changePasswordForm = document.getElementById('change-password-form');

const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');
const showChangePasswordBtn = document.getElementById('show-change-password');
const showLoginFromChangeBtn = document.getElementById('show-login-from-change');

const changeUsernameInput = document.getElementById('change-username');
const usernameVerifyIndicator = document.getElementById('username-verify-indicator');

const alertBox = document.getElementById('auth-alert');
const alertMsg = alertBox.querySelector('.alert-message');

function showAlert(msg, isSuccess = false) {
    alertBox.className = 'alert ' + (isSuccess ? 'alert-success' : 'alert-error');
    alertMsg.textContent = msg;
    alertBox.classList.remove('hidden');
}

function closeAlert() {
    alertBox.classList.add('hidden');
}

showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeAlert();
    loginForm.classList.add('hidden');
    changePasswordForm.classList.add('hidden');
    mfaForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    registerForm.style.animation = 'slideIn 0.4s ease forwards';
});

function showLoginForm() {
    closeAlert();
    registerForm.classList.add('hidden');
    changePasswordForm.classList.add('hidden');
    mfaForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    loginForm.style.animation = 'slideIn 0.4s ease forwards';
}

showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
});

showChangePasswordBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeAlert();
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    mfaForm.classList.add('hidden');
    changePasswordForm.classList.remove('hidden');
    changePasswordForm.style.animation = 'slideIn 0.4s ease forwards';
    changeUsernameInput.value = '';
    usernameVerifyIndicator.textContent = '';
});

showLoginFromChangeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
});

changeUsernameInput.addEventListener('blur', async () => {
    const username = changeUsernameInput.value.trim();
    if (username.length < 3) {
        usernameVerifyIndicator.textContent = '';
        return;
    }
    usernameVerifyIndicator.textContent = 'Verifying...';
    usernameVerifyIndicator.style.color = 'var(--text-secondary)';
    
    try {
        const response = await fetch(`/api/verify-username?username=${encodeURIComponent(username)}`);
        if (response.ok) {
            const result = await response.json();
            if (result.exists) {
                usernameVerifyIndicator.textContent = '✓ Verified';
                usernameVerifyIndicator.style.color = 'var(--color-success)';
            } else {
                usernameVerifyIndicator.textContent = '✗ Not Found';
                usernameVerifyIndicator.style.color = 'var(--color-secondary)';
            }
        } else {
            usernameVerifyIndicator.textContent = '✗ Error';
            usernameVerifyIndicator.style.color = 'var(--color-secondary)';
        }
    } catch (err) {
        usernameVerifyIndicator.textContent = '✗ Offline';
        usernameVerifyIndicator.style.color = 'var(--color-secondary)';
    }
});

const mfaForm = document.getElementById('mfa-form');
const cancelMfaBtn = document.getElementById('cancel-mfa');

let tempLoginToken = null;
let emailVerified = false;
let phoneVerified = false;
let registrationOtpEnabled = true;

const emailInput = document.getElementById('register-email');
const phoneInput = document.getElementById('register-phone');

const btnSendEmailOtp = document.getElementById('btn-send-email-otp');
const btnVerifyEmailOtp = document.getElementById('btn-verify-email-otp');
const emailOtpContainer = document.getElementById('email-otp-container');
const emailOtpInput = document.getElementById('email-otp');
const emailVerifyStatus = document.getElementById('email-verify-status');

const btnSendPhoneOtp = document.getElementById('btn-send-phone-otp');
const btnVerifyPhoneOtp = document.getElementById('btn-verify-phone-otp');
const phoneOtpContainer = document.getElementById('phone-otp-container');
const phoneOtpInput = document.getElementById('phone-otp');
const phoneVerifyStatus = document.getElementById('phone-verify-status');
const registerSubmitBtn = document.getElementById('btn-register-submit');

async function sendOtp(target, statusElement, containerElement) {
    statusElement.textContent = 'Sending OTP...';
    statusElement.style.color = 'var(--text-secondary)';
    try {
        const response = await fetch('/api/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            statusElement.textContent = 'OTP sent! Check console logs.';
            statusElement.style.color = 'var(--text-primary)';
            containerElement.classList.remove('hidden');
        } else {
            statusElement.textContent = result.error || 'Failed to send OTP.';
            statusElement.style.color = 'var(--color-secondary)';
        }
    } catch (err) {
        statusElement.textContent = 'Network error sending OTP.';
        statusElement.style.color = 'var(--color-secondary)';
    }
}

async function verifyOtpCode(target, otpCode, statusElement, onSuccess) {
    statusElement.textContent = 'Verifying...';
    statusElement.style.color = 'var(--text-secondary)';
    try {
        const response = await fetch('/api/otp/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, otp_code: otpCode })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            statusElement.textContent = '✓ Verified successfully!';
            statusElement.style.color = 'var(--color-success)';
            onSuccess();
            checkRegistrationReady();
        } else {
            statusElement.textContent = result.error || 'Invalid or expired OTP.';
            statusElement.style.color = 'var(--color-secondary)';
        }
    } catch (err) {
        statusElement.textContent = 'Network error verifying OTP.';
        statusElement.style.color = 'var(--color-secondary)';
    }
}

function checkRegistrationReady() {
    if (!registrationOtpEnabled) {
        registerSubmitBtn.disabled = false;
        registerSubmitBtn.style.opacity = '1';
        registerSubmitBtn.style.cursor = 'pointer';
        return;
    }
    if (emailVerified && phoneVerified) {
        registerSubmitBtn.disabled = false;
        registerSubmitBtn.style.opacity = '1';
        registerSubmitBtn.style.cursor = 'pointer';
    } else {
        registerSubmitBtn.disabled = true;
        registerSubmitBtn.style.opacity = '0.5';
        registerSubmitBtn.style.cursor = 'not-allowed';
    }
}

btnSendEmailOtp.addEventListener('click', () => {
    const email = emailInput.value.trim();
    if (!email) {
        emailVerifyStatus.textContent = 'Please enter a valid email first.';
        emailVerifyStatus.style.color = 'var(--color-secondary)';
        return;
    }
    sendOtp(email, emailVerifyStatus, emailOtpContainer);
});

btnVerifyEmailOtp.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const otp = emailOtpInput.value.trim();
    if (otp.length !== 6) {
        emailVerifyStatus.textContent = 'OTP must be 6 digits.';
        emailVerifyStatus.style.color = 'var(--color-secondary)';
        return;
    }
    verifyOtpCode(email, otp, emailVerifyStatus, () => {
        emailVerified = true;
        emailInput.disabled = true;
        btnSendEmailOtp.disabled = true;
        emailOtpInput.disabled = true;
        btnVerifyEmailOtp.disabled = true;
    });
});

btnSendPhoneOtp.addEventListener('click', () => {
    const phone = phoneInput.value.trim();
    if (!phone) {
        phoneVerifyStatus.textContent = 'Please enter a valid phone number first.';
        phoneVerifyStatus.style.color = 'var(--color-secondary)';
        return;
    }
    sendOtp(phone, phoneVerifyStatus, phoneOtpContainer);
});

btnVerifyPhoneOtp.addEventListener('click', () => {
    const phone = phoneInput.value.trim();
    const otp = phoneOtpInput.value.trim();
    if (otp.length !== 6) {
        phoneVerifyStatus.textContent = 'OTP must be 6 digits.';
        phoneVerifyStatus.style.color = 'var(--color-secondary)';
        return;
    }
    verifyOtpCode(phone, otp, phoneVerifyStatus, () => {
        phoneVerified = true;
        phoneInput.disabled = true;
        btnSendPhoneOtp.disabled = true;
        phoneOtpInput.disabled = true;
        btnVerifyPhoneOtp.disabled = true;
    });
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        if (response.ok) {
            if (result.mfa_required) {
                tempLoginToken = result.temp_token;
                loginForm.classList.add('hidden');
                mfaForm.classList.remove('hidden');
                mfaForm.style.animation = 'slideIn 0.4s ease forwards';
                showAlert('Credentials valid. OTP sent to mobile.', true);
            } else if (result.success) {
                showAlert('Success! Redirecting...', true);
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            }
        } else {
            showAlert(result.message || 'Login failed.');
        }
    } catch (err) {
        showAlert('Error: ' + err.name + ': ' + err.message);
        console.error('Login error:', err);
    }
});

mfaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = document.getElementById('mfa-otp').value;
    try {
        const response = await fetch('/api/login/mfa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ temp_token: tempLoginToken, otp_code: otp })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAlert('OTP verified! Redirecting...', true);
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            showAlert(result.error || 'Invalid or expired OTP.');
        }
    } catch (err) {
        showAlert('Network error verifying OTP.');
    }
});

cancelMfaBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const firstname = document.getElementById('register-firstname').value;
    const lastname = document.getElementById('register-lastname').value;
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPass = document.getElementById('register-confirm').value;

    if (password !== confirmPass) {
        showAlert('Passwords do not match.');
        return;
    }
    if (registrationOtpEnabled && (!emailVerified || !phoneVerified)) {
        showAlert('Please verify both your email and phone number first.');
        return;
    }

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                password,
                first_name: firstname,
                last_name: lastname,
                email,
                phone
            })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAlert('Account created! Redirecting...', true);
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        } else {
            showAlert(result.message || 'Registration failed.');
        }
    } catch (err) {
        showAlert('Error: ' + err.name + ': ' + err.message);
        console.error('Registration error:', err);
    }
});

changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = changeUsernameInput.value.trim();
    const newPassword = document.getElementById('change-password').value;
    const confirmPassword = document.getElementById('change-confirm').value;

    if (newPassword !== confirmPassword) {
        showAlert('New passwords do not match.');
        return;
    }

    try {
        const response = await fetch('/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, new_password: newPassword, confirm_password: confirmPassword })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showAlert('Password updated successfully! Redirecting to login...', true);
            setTimeout(() => {
                showLoginForm();
            }, 1500);
        } else {
            showAlert(result.message || 'Failed to change password.');
        }
    } catch (err) {
        showAlert('Error: ' + err.name + ': ' + err.message);
        console.error('Password change error:', err);
    }
});

async function loadSecuritySettings() {
    try {
        const response = await fetch('/api/settings/public');
        if (response.ok) {
            const settings = await response.json();
            registrationOtpEnabled = settings.registration_otp_enabled;
            
            const otpFieldsContainer = document.getElementById('otp-registration-fields');
            const firstnameInput = document.getElementById('register-firstname');
            const lastnameInput = document.getElementById('register-lastname');
            
            if (registrationOtpEnabled) {
                otpFieldsContainer.classList.remove('hidden');
                firstnameInput.required = true;
                lastnameInput.required = true;
                emailInput.required = true;
                phoneInput.required = true;
                checkRegistrationReady();
            } else {
                otpFieldsContainer.classList.add('hidden');
                firstnameInput.required = false;
                lastnameInput.required = false;
                emailInput.required = false;
                phoneInput.required = false;
                checkRegistrationReady();
            }
        }
    } catch (err) {
        console.error("Failed to load security settings:", err);
    }
}

loadSecuritySettings();

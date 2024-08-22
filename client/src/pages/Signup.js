import React, { useState } from "react";
import {
    Container,
    Typography,
    Paper,
    TextField,
    Button,
} from '@mui/material';

const SignupForm = () => {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [errors, setErrors] = useState({});
    const [formLoading, setFormLoading] = useState(false);
    const [success, setSuccess] = useState(null);

    const validate = () => {
		const errors = {};
        if(!username.trim()){
            errors.username = "Username is required";
        }
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!email) {
			errors.email = "Email is required";
		} else if (!emailRegex.test(email.trim().toLowerCase())) {
			errors.email = "Email is not valid";
		}
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{4,12}$/;
		if (!password) {
			errors.password = "Password is required";
		} else if (!passwordRegex.test(password)) {
			errors.password =
				"Password must contain at least one letter, one number, and be between 4 and 12 characters long";
		}
        if (password !== confirmPassword) {
            errors.confirmPassword = "Passwords do not match";
        }
		return errors;
	};

    const handleSubmit = async (e) => {
        if (formLoading) return;
        setFormLoading(true);
        setSuccess(null);
        setErrors({});
        e.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            setFormLoading(false);
            return;
        }
        try {
            const url = `${process.env.REACT_APP_API_BASE_URL}/signup`;
            console.log(url);   
            const response = await fetch(
                `${process.env.REACT_APP_API_BASE_URL}/signup`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        username: username.trim(),
                        email: email.toLowerCase().trim(),
                        password,
                        confirmPassword,
                    }),
                }
            );
            if (!response.ok) {
                const errorData = await response.json().catch(() => {
                    throw new Error(JSON.stringify({message: "Network response was not ok"}));
                });
                throw new Error(JSON.stringify(errorData.errors));
            }
            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('userInfo', JSON.stringify(data.userInfo));
            setSuccess(data.message);
        } catch (error) {
            setErrors(JSON.parse(error.message));  
        } finally {
            setFormLoading(false);
        }
    };
    return (
        <Container maxWidth="sm" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', mt: 3 }}>
            <Paper elevation={3} sx={{ p: 3, mb: 3, width: '100%' }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, borderBottom: '1px solid #ccc', pb: 1 }}>
                    Add User
                </Typography>
                <form onSubmit={handleSubmit}>
                    <TextField
                        label="Username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        fullWidth
                        margin="normal"
                        required
                        error={!!errors.username}
                        helperText={errors.username}
                    />
                    <TextField
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        fullWidth
                        margin="normal"
                        required
                        error={!!errors.email}
                        helperText={errors.email}
                    />
                    <TextField
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        fullWidth
                        margin="normal"
                        required
                        error={!!errors.password}
                        helperText={errors.password}
                    />
                    <TextField
                        label="Confirm Password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        fullWidth
                        margin="normal"
                        required
                        error={!!errors.confirmPassword}
                        helperText={errors.confirmPassword}
                    />
                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        fullWidth
                        disabled={formLoading}
                        sx={{
                            backgroundColor: formLoading ? 'grey.500' : 'primary.main',
                            cursor: formLoading ? 'not-allowed' : 'pointer',
                            mt: 2,
                        }}
                    >
                        {formLoading ? 'Adding User...' : 'Add User'}
                    </Button>
                    {success && <Typography color="success.main" sx={{ mt: 2 }}>{success}</Typography>}
                    {errors.message && <Typography color="error.main" sx={{ mt: 2 }}>{errors.message}</Typography>}
                </form>
            </Paper>
        </Container>
    );
};
 

function Signup() {
    return ( 
        <React.Fragment>
            <SignupForm/>
        </React.Fragment>
    );
}

export default Signup;
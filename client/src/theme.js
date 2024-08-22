import { createTheme } from "@mui/material/styles";
import "@fontsource/amiri-quran";

const theme = createTheme({
    palette: {
        mode: "light", // You can switch to "dark" for dark mode
        primary: {
            main: "#5d9096",
            light: "#8b9bd6",
            dark: "#3a6b7a",
            contrastText: "#ffffff", // Ensure text is readable on primary color
        },
        secondary: {
            main: "#9c27b0",
            light: "#ba68c8",
            dark: "#6a1b9a",
            contrastText: "#ffffff", // Ensure text is readable on secondary color
        },
        error: {
            main: "#d32f2f",
            contrastText: "#ffffff",
        },
        success: {
            main: "#388e3c",
            contrastText: "#ffffff",
        },
        background: {
            default: "#f5f5f5",
            paper: "#ffffff",
        },
        text: {
            primary: "#333333",
            secondary: "#666666",
            disabled: "#9e9e9e",
            hint: "#bdbdbd",
        },
        grey: {
            100: "#f5f5f5",
            200: "#eeeeee",
            300: "#e0e0e0",
            400: "#bdbdbd",
            500: "#9e9e9e",
            600: "#757575",
            700: "#616161",
            800: "#424242",
            900: "#212121",
        },
    },
    typography: {
        fontFamily: '"Amiri Quran", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
            fontWeight: 700,
            fontSize: "3rem", // Increased from 2.5rem to 3rem
        },
        h2: {
            fontWeight: 700,
            fontSize: "2.5rem", // Increased from 2rem to 2.5rem
        },
        h3: {
            fontWeight: 600,
            fontSize: "2rem", // Increased from 1.75rem to 2rem
        },
        h4: {
            fontWeight: 600,
            fontSize: "1.75rem", // Increased from 1.5rem to 1.75rem
        },
        h5: {
            fontWeight: 500,
            fontSize: "1.5rem", // Increased from 1.25rem to 1.5rem
        },
        h6: {
            fontWeight: 500,
            fontSize: "1.25rem", // Increased from 1rem to 1.25rem
        },
        subtitle1: {
            fontWeight: 400,
            fontSize: "1rem", // Increased from 0.875rem to 1rem
        },
        subtitle2: {
            fontWeight: 400,
            fontSize: "0.875rem", // Increased from 0.75rem to 0.875rem
        },
        body1: {
            fontWeight: 400,
            fontSize: "1.125rem", // Increased from 1rem to 1.125rem
        },
        body2: {
            fontWeight: 400,
            fontSize: "1rem", // Increased from 0.875rem to 1rem
        },
        button: {
            fontWeight: 500,
            fontSize: "1rem", // Increased from 0.875rem to 1rem
            textTransform: "none",
        },
        caption: {
            fontWeight: 400,
            fontSize: "0.875rem", // Increased from 0.75rem to 0.875rem
        },
        overline: {
            fontWeight: 400,
            fontSize: "0.75rem", // Increased from 0.625rem to 0.75rem
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    boxShadow: "0 3px 5px 2px rgba(0, 0, 0, .1)",
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                colorPrimary: {
                    backgroundColor: "#5d9096",
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: "#f5f5f5",
                },
            },
        },
    },
});

export default theme;
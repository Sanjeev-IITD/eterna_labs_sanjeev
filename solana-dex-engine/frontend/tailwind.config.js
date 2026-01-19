/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Option A: Teal Minimal (Refined)
                background: '#0B0F14',
                surface: '#111827',
                'surface-2': '#0F172A',
                border: '#1F2937',
                text: {
                    DEFAULT: '#E5E7EB',
                    muted: '#94A3B8',
                },
                primary: {
                    DEFAULT: '#14B8A6', // Teal-500
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    200: '#99f6e4',
                    300: '#5eead4',
                    400: '#2dd4bf',
                    500: '#14b8a6',
                    600: '#0d9488',
                    700: '#0f766e',
                    800: '#115e59',
                    900: '#134e4a',
                },
                success: '#22C55E',
                warning: '#F59E0B',
                error: '#EF4444',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'slide-in': 'slideIn 0.3s ease-out',
                'fade-in': 'fadeIn 0.2s ease-out',
                'bounce-subtle': 'bounceSubtle 2s infinite',
            },
            keyframes: {
                slideIn: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                bounceSubtle: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' },
                },
            },
            backdropBlur: {
                xs: '2px',
            },
            boxShadow: {
                'glow': '0 0 20px rgba(20, 184, 166, 0.3)', // Updated to match Teal
                'glow-lg': '0 0 40px rgba(20, 184, 166, 0.4)',
            },
            fontFamily: {
                sans: ['"IBM Plex Sans"', 'sans-serif'],
            },
        },
    },
    plugins: [],
}

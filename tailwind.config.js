/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        orbitron: ['var(--font-display)'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
        ink: '#1a1a1a',
        canvas: '#ebe8e4',
        paper: '#f5f3f0',
        hair: '#cfccc7',
        flame: { DEFAULT: '#ff3c00', mid: '#ff6a00', light: '#ffaa00', deep: '#8a2e00' },
        orange: { DEFAULT: '#ff3c00', 50: '#fff1ea', 100: '#ffe0d1', 200: '#ffc2a3', 300: '#ff8f5c', 400: '#ff5a1f', 500: '#ff3c00', 600: '#e03500', 700: '#b82b00', 800: '#8a2e00', 900: '#5c1e00' },
        amber: { 50: '#fff6e6', 100: '#ffe8bf', 200: '#ffcf80', 300: '#ff9a33', 400: '#ff8a00', 500: '#ff7a00', 600: '#e06a00', 700: '#b35300', 800: '#8a3f00', 900: '#5c2a00' },
        yellow: { 50: '#fff8e6', 100: '#ffefbf', 200: '#ffd27a', 300: '#ffb020', 400: '#f59e0b', 500: '#d97706', 600: '#b45309', 700: '#92400e', 800: '#78350f', 900: '#451a03' },
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		boxShadow: {
			'orange-glow': '0 10px 30px -12px rgba(255, 60, 0, 0.35)',
			'orange-glow-sm': '0 6px 18px -10px rgba(255, 60, 0, 0.35)',
		},
		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
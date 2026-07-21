import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['DM Sans', 'system-ui', 'sans-serif'],
      },
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					glow: 'hsl(var(--primary-glow))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				orange: {
					DEFAULT: 'hsl(var(--orange))',
					foreground: 'hsl(var(--orange-foreground))'
				},
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))'
				},
				neutral: {
					DEFAULT: 'hsl(var(--neutral))',
					foreground: 'hsl(var(--neutral-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
					vibrant: 'hsl(var(--accent-vibrant))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
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
				},
				surface: {
					1: 'hsl(var(--surface-1))',
					2: 'hsl(var(--surface-2))',
					3: 'hsl(var(--surface-3))'
				},
				'brand-ink': 'hsl(var(--brand-ink))'
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-subtle': 'var(--gradient-subtle)',
				'gradient-card': 'var(--gradient-card)',
				'gradient-accent': 'var(--gradient-accent)'
			},
			boxShadow: {
				'elegant': 'var(--shadow-elegant)',
				'card': 'var(--shadow-card)',
				'glow': 'var(--shadow-glow)',
				'soft': 'var(--shadow-soft)'
			},
			transitionTimingFunction: {
				'smooth': 'var(--transition-smooth)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
			'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(4px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'fade-out': {
					'0%': {
						opacity: '1',
						transform: 'translateY(0)'
					},
					'100%': {
						opacity: '0',
						transform: 'translateY(10px)'
					}
				},
				'scale-in': {
					'0%': {
						transform: 'scale(0.95)',
						opacity: '0'
					},
					'100%': {
						transform: 'scale(1)',
						opacity: '1'
					}
				},
				'hover-lift': {
					'0%': {
						transform: 'translateY(0)'
					},
					'100%': {
						transform: 'translateY(-2px)'
					}
				},
				'shimmer': {
					'0%': { backgroundPosition: '-200% 0' },
					'100%': { backgroundPosition: '200% 0' }
				},
				'pulse-subtle': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' }
				},
				'spin-burst': {
					'0%': { transform: 'rotate(0deg)' },
					'15%': { transform: 'rotate(1080deg)' },
					'100%': { transform: 'rotate(1080deg)' }
				},
				'page-enter': {
					'0%': { opacity: '0.4', transform: 'translateY(4px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'toast-enter': {
					'0%':   { opacity: '0', transform: 'translateX(40px) scale(0.96)' },
					'60%':  { opacity: '1', transform: 'translateX(-4px) scale(1)' },
					'100%': { opacity: '1', transform: 'translateX(0) scale(1)' }
				},
				'toast-exit': {
					'0%':   { opacity: '1', transform: 'translateX(0) scale(1)' },
					'100%': { opacity: '0', transform: 'translateX(40px) scale(0.96)' }
				},
				'notification-enter': {
					'0%':   { opacity: '0', transform: 'translateX(16px)' },
					'100%': { opacity: '1', transform: 'translateX(0)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.25s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
				'fade-out': 'fade-out 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'hover-lift': 'hover-lift 0.2s ease-out',
				'shimmer': 'shimmer 2s infinite linear',
				'pulse-subtle': 'pulse-subtle 3s infinite ease-in-out',
				'spin-burst': 'spin-burst 5s ease-in-out infinite',
				'page-enter': 'page-enter 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
				'toast-enter': 'toast-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
				'toast-exit': 'toast-exit 0.22s cubic-bezier(0.4, 0, 1, 1) both',
				'notification-enter': 'notification-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1) both'
			},
			spacing: {
				'xs': 'var(--spacing-xs)',
				'sm-custom': 'var(--spacing-sm)',
				'md-custom': 'var(--spacing-md)',
				'lg-custom': 'var(--spacing-lg)',
				'xl-custom': 'var(--spacing-xl)',
				'2xl-custom': 'var(--spacing-2xl)'
			}
		}
	},
	plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

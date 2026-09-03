import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

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
      transitionProperty: {
        /**
         * O que muda numa interação — e só isso. `transition-all` animava
         * largura, altura e posição junto com a cor: era o "amolecimento"
         * de tudo ao passar o rato, e punha o compositor a trabalhar à toa.
         * Eram 73 usos.
         */
        ui: 'color, background-color, border-color, text-decoration-color, fill, stroke, box-shadow, transform, opacity',
      },
      fontSize: {
        /**
         * A escala inteira, e não só o pé dela.
         *
         * A primeira tentativa apertou micro/xs/sm e deixou base, lg, xl,
         * 2xl e 4xl nos valores de fábrica do Tailwind. O resultado foi o
         * pior dos dois mundos: o corpo do texto a 13px debaixo de títulos
         * a 24px e de um número a 36px. O salto de 13 para 24 é de 1,85× —
         * é isso que se lê como "grosso", não o tamanho de cada peça.
         *
         * Agora o degrau é de ~1,15 do princípio ao fim, e a escala está em
         * `rem`, portanto acompanha a raiz — que por sua vez acompanha a
         * resolução (ver o `html { font-size: clamp(...) }` em `index.css`).
         * Os números abaixo são o que se vê num ecrã de 1440:
         *
         *   micro 11,4 · xs 11,4 · sm 12,4 · base 13,3 · lg 15,2 · xl 17,1
         *   · 2xl 19 · 3xl 22,8 · 4xl 26,6 · 5xl 32,3
         *
         * Num monitor de 2560 o mesmo texto sai ~12% maior, e num portátil
         * de 1280 ~6% menor. As páginas públicas não vêm por aqui: têm CSS
         * próprio com `clamp()` em `index.css`.
         *
         * O que continua proibido é o tamanho escrito à mão: eram 399, em
         * quatorze degraus, e voltam sozinhos se ninguém contar.
         */
        micro: ['0.75rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.0625rem' }],
        sm: ['0.8125rem', { lineHeight: '1.125rem' }],
        base: ['0.875rem', { lineHeight: '1.25rem' }],
        lg: ['1rem', { lineHeight: '1.375rem' }],
        xl: ['1.125rem', { lineHeight: '1.5rem' }],
        '2xl': ['1.25rem', { lineHeight: '1.625rem' }],
        '3xl': ['1.5rem', { lineHeight: '1.875rem' }],
        '4xl': ['1.75rem', { lineHeight: '2.125rem' }],
        '5xl': ['2.125rem', { lineHeight: '2.375rem' }],
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
					3: 'hsl(var(--surface-3))',
					page: 'hsl(var(--surface-page))',
					card: 'hsl(var(--surface-card))',
					elevated: 'hsl(var(--surface-elevated))'
				},
				'border-strong': 'hsl(var(--border-strong))',
				severity: {
					critical: 'hsl(var(--severity-critical))',
					high: 'hsl(var(--severity-high))',
					medium: 'hsl(var(--severity-medium))',
					low: 'hsl(var(--severity-low))',
					none: 'hsl(var(--severity-none))'
				},
				state: {
					rest: 'hsl(var(--state-rest))',
					'rest-surface': 'hsl(var(--state-rest-surface))',
					active: 'hsl(var(--state-active))',
					'active-surface': 'hsl(var(--state-active-surface))',
					done: 'hsl(var(--state-done))',
					'done-surface': 'hsl(var(--state-done-surface))'
				},
				chart: {
					1: 'hsl(var(--chart-1))',
					2: 'hsl(var(--chart-2))',
					3: 'hsl(var(--chart-3))',
					4: 'hsl(var(--chart-4))',
					5: 'hsl(var(--chart-5))',
					6: 'hsl(var(--chart-6))',
					grid: 'hsl(var(--chart-grid))',
					axis: 'hsl(var(--chart-axis))'
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
				/**
				 * Um raio, e só um.
				 *
				 * A versão anterior tinha dois — 4px para controlo, 10px para
				 * contentor — e a ideia era que o contraste fosse decisão de
				 * forma. Na prática somaram-se a esses o `rounded` de fábrica
				 * (3,73px), o `rounded-xl`/`2xl` que ninguém tinha mapeado e a
				 * pílula dos estados, e o resultado eram cinco cantos
				 * diferentes no mesmo ecrã.
				 *
				 * Agora todos os degraus apontam para `--radius`. Escrever
				 * `rounded-sm` ou `rounded-2xl` dá exatamente o mesmo canto,
				 * portanto nem é preciso corrigir as 576 classes já escritas.
				 * `rounded-full` fica reservado ao que é mesmo redondo:
				 * avatar, ponto e barra de progresso.
				 */
				DEFAULT: 'var(--radius)',
				sm: 'var(--radius)',
				md: 'var(--radius)',
				lg: 'var(--radius)',
				xl: 'var(--radius)',
				'2xl': 'var(--radius)',
				'3xl': 'var(--radius)'
			},
			keyframes: {
				/* O `input-otp` pede `animate-caret-blink` e o fotograma nunca foi
				   declarado: a classe nao gerava regra e o cursor ficava parado,
				   sem indicar onde se estava a escrever. */
				'caret-blink': {
					'0%,70%,100%': { opacity: '1' },
					'20%,50%': { opacity: '0' }
				},
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
				},
				'tab-enter': {
					'0%':   { transform: 'translateY(4px)' },
					'100%': { transform: 'translateY(0)' }
				}
			},
			animation: {
				'caret-blink': 'caret-blink 1.25s ease-out infinite',
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
				'notification-enter': 'notification-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
				'tab-enter': 'tab-enter 0.24s cubic-bezier(0.22, 1, 0.36, 1) both'
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
	plugins: [animate, typography],
} satisfies Config;

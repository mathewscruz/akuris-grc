import { handleResendWelcomeEmail } from './handler.ts'

Deno.serve((req) => handleResendWelcomeEmail(req))

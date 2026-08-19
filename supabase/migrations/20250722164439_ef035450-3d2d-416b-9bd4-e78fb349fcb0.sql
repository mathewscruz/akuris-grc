
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  link_to TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications" 
  ON public.notifications 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
  ON public.notifications 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_notifications_updated_at 
  BEFORE UPDATE ON public.notifications 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample notifications for testing
INSERT INTO public.notifications (user_id, title, message, type, link_to) 
SELECT 
  auth.uid(),
  'Novo ativo cadastrado',
  'Um novo servidor foi adicionado ao inventário',
  'success',
  '/ativos'
WHERE auth.uid() IS NOT NULL;

INSERT INTO public.notifications (user_id, title, message, type, link_to) 
SELECT 
  auth.uid(),
  'Auditoria pendente',
  'Há uma auditoria aguardando sua aprovação',
  'warning',
  '/auditorias'
WHERE auth.uid() IS NOT NULL;

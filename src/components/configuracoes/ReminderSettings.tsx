import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatCard } from "@/components/ui/stat-card"
import { toast } from "sonner"
import { supabase } from "@/integrations/supabase/client"
import { Bell, Mail, Clock, Users, TrendingUp } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"

interface ReminderSettingsData {
  id?: string
  empresa_id: string
  reminders_enabled: boolean
  reminder_intervals: number[]
  max_reminders: number
}

interface ReminderStats {
  total_invited: number
  pending_reminders: number
  completed_invitations: number
  reminder_effectiveness: number
}

export function ReminderSettings() {
  const { t } = useLanguage()
  const [settings, setSettings] = useState<ReminderSettingsData>({
    empresa_id: '',
    reminders_enabled: true,
    reminder_intervals: [3, 7, 14],
    max_reminders: 3
  })
  const [stats, setStats] = useState<ReminderStats>({
    total_invited: 0,
    pending_reminders: 0,
    completed_invitations: 0,
    reminder_effectiveness: 0
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    if (settings.empresa_id) {
      loadStats()
    }
  }, [settings.empresa_id])

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('Usuário não autenticado')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('user_id', user.id)
        .single()

      if (profileError || !profile) {
        console.error('Erro ao buscar perfil:', profileError)
        return
      }

      const { data, error } = await supabase
        .from('empresa_reminder_settings')
        .select('*')
        .eq('empresa_id', profile.empresa_id)
        .maybeSingle()

      if (error) {
        console.error('Erro ao carregar configurações:', error)
        return
      }

      if (data) {
        setSettings(data)
      } else {
        setSettings({
          empresa_id: profile.empresa_id,
          reminders_enabled: true,
          reminder_intervals: [3, 7, 14],
          max_reminders: 3
        })
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const empresaId = settings.empresa_id;
      if (!empresaId) return;

      const { count: totalInvited } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .not('temporary_passwords', 'is', null)

      const { count: pendingReminders } = await supabase
        .from('user_invitation_reminders')
        .select('*, profiles!inner(empresa_id)', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('profiles.empresa_id', empresaId)

      const { count: completedInvitations } = await supabase
        .from('user_invitation_reminders')
        .select('*, profiles!inner(empresa_id)', { count: 'exact', head: true })
        .eq('status', 'completed')
        .eq('profiles.empresa_id', empresaId)

      const effectiveness = totalInvited > 0 
        ? Math.round(((completedInvitations || 0) / totalInvited) * 100)
        : 0

      setStats({
        total_invited: totalInvited || 0,
        pending_reminders: pendingReminders || 0,
        completed_invitations: completedInvitations || 0,
        reminder_effectiveness: effectiveness
      })
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('empresa_reminder_settings')
        .upsert(settings)

      if (error) throw error

      toast.success(t('configPerms.reminderSettings.settingsSavedTitle'), {
        description: t('configPerms.reminderSettings.settingsSavedDesc'),
      })
    } catch (error: any) {
      console.error('Erro ao salvar:', error)
      toast.error(t('configPerms.reminderSettings.errorSavingTitle'), {
        description: error.message,
      })
    } finally {
      setSaving(false)
    }
  }

  const processReminders = async () => {
    setProcessing(true)
    try {
      const { data, error } = await supabase.functions.invoke('process-invitation-reminders', {
        body: {}
      })

      if (error) throw error

      toast.success(t('configPerms.reminderSettings.remindersProcessedTitle'), {
        description: t('configPerms.reminderSettings.remindersProcessedDesc').replace('{count}', String(data.sent)),
      })

      loadStats()
    } catch (error: any) {
      console.error('Erro ao processar lembretes:', error)
      toast.error(t('configPerms.reminderSettings.errorProcessingTitle'), {
        description: error.message,
      })
    } finally {
      setProcessing(false)
    }
  }

  const updateInterval = (index: number, value: string) => {
    const newIntervals = [...settings.reminder_intervals]
    newIntervals[index] = parseInt(value) || 0
    setSettings({ ...settings, reminder_intervals: newIntervals })
  }

  if (loading) {
    return <div className="p-6">{t('configPerms.reminderSettings.loading')}</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('configPerms.reminderSettings.statUsersInvited')}
          value={stats.total_invited}
          icon={<Users className="h-4 w-4" />}
          variant="info"
        />
        <StatCard
          title={t('configPerms.reminderSettings.statPendingReminders')}
          value={stats.pending_reminders}
          icon={<Clock className="h-4 w-4" />}
          variant="warning"
        />
        <StatCard
          title={t('configPerms.reminderSettings.statAcceptedInvites')}
          value={stats.completed_invitations}
          icon={<Mail className="h-4 w-4" />}
          variant="success"
        />
        <StatCard
          title={t('configPerms.reminderSettings.statConversionRate')}
          value={`${stats.reminder_effectiveness}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          variant="primary"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('configPerms.reminderSettings.cardTitle')}
          </CardTitle>
          <CardDescription>
            {t('configPerms.reminderSettings.cardDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">{t('configPerms.reminderSettings.autoRemindersLabel')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('configPerms.reminderSettings.autoRemindersDesc')}
              </p>
            </div>
            <Switch
              checked={settings.reminders_enabled}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, reminders_enabled: checked })
              }
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base">{t('configPerms.reminderSettings.intervalsLabel')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('configPerms.reminderSettings.intervalsDesc')}
            </p>
            <div className="grid grid-cols-3 gap-4">
              {settings.reminder_intervals.map((interval, index) => (
                <div key={index} className="space-y-2">
                  <Label className="text-sm">
                    {index === 0 ? t('configPerms.reminderSettings.reminder1') : 
                     index === 1 ? t('configPerms.reminderSettings.reminder2') : 
                     t('configPerms.reminderSettings.reminder3')}
                  </Label>
                  <Input
                    type="number"
                    value={interval}
                    onChange={(e) => updateInterval(index, e.target.value)}
                    min="1"
                    max="30"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-base">{t('configPerms.reminderSettings.maxRemindersLabel')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('configPerms.reminderSettings.maxRemindersDesc')}
            </p>
            <Input
              type="number"
              value={settings.max_reminders}
              onChange={(e) => setSettings({ 
                ...settings, 
                max_reminders: parseInt(e.target.value) || 3 
              })}
              min="1"
              max="10"
              className="w-24"
            />
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
            <Button 
              onClick={saveSettings} 
              disabled={saving}
            >
              {saving ? t('configPerms.reminderSettings.savingButton') : t('configPerms.reminderSettings.saveButton')}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={processReminders}
              disabled={processing || !settings.reminders_enabled}
            >
              {processing ? t('configPerms.reminderSettings.processingButton') : t('configPerms.reminderSettings.processButton')}
            </Button>
          </div>

          <div className="bg-muted p-4 rounded-lg border border-border">
            <h4 className="font-medium text-foreground mb-2">{t('configPerms.reminderSettings.howItWorksTitle')}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {t('configPerms.reminderSettings.howItWorks1')}</li>
              <li>• {t('configPerms.reminderSettings.howItWorks2')}</li>
              <li>• {t('configPerms.reminderSettings.howItWorks3')}</li>
              <li>• {t('configPerms.reminderSettings.howItWorks4')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

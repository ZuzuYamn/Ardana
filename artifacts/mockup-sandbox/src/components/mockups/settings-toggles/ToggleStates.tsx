import * as React from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

function ToggleRow({
  dir,
  checked,
  onCheckedChange,
  label,
  desc,
}: {
  dir: 'ltr' | 'rtl'
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label: string
  desc: string
}) {
  return (
    <div
      dir={dir}
      className="flex items-center justify-between p-4 rounded-xl border bg-card gap-4"
    >
      <div className="space-y-0.5">
        <Label className="text-base text-start">{label}</Label>
        <p className="text-sm text-muted-foreground text-start">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export function ToggleStates() {
  const [highContrast, setHighContrast] = React.useState(true)
  const [weather, setWeather] = React.useState(true)
  const [tasks, setTasks] = React.useState(false)

  return (
    <div className="min-h-screen bg-background p-8 text-foreground">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold mb-4">LTR (English)</h2>
          <Card dir="ltr" className="border-border">
            <CardContent className="space-y-4 p-4">
              <ToggleRow
                dir="ltr"
                checked={highContrast}
                onCheckedChange={setHighContrast}
                label="High Contrast"
                desc="Increase visual contrast"
              />
              <ToggleRow
                dir="ltr"
                checked={weather}
                onCheckedChange={setWeather}
                label="Weather Alerts"
                desc="Notify about extreme weather"
              />
              <ToggleRow
                dir="ltr"
                checked={tasks}
                onCheckedChange={setTasks}
                label="Task Reminders"
                desc="Remind about pending tasks"
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">RTL (العربية)</h2>
          <Card dir="rtl" className="border-border">
            <CardContent className="space-y-4 p-4">
              <ToggleRow
                dir="rtl"
                checked={highContrast}
                onCheckedChange={setHighContrast}
                label="تباين عالي"
                desc="زيادة التباين البصري"
              />
              <ToggleRow
                dir="rtl"
                checked={weather}
                onCheckedChange={setWeather}
                label="تنبيهات الطقس"
                desc="إشعار بشأن الطقس المتطرف"
              />
              <ToggleRow
                dir="rtl"
                checked={tasks}
                onCheckedChange={setTasks}
                label="تذكير المهام"
                desc="تذكير بالمهام المعلقة"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8 p-4 rounded-xl border bg-muted/50">
        <p className="text-sm text-muted-foreground">
          Click toggles in either panel. In LTR, ON = thumb on the right. In RTL, ON = thumb on the left. Colors should match state.
        </p>
      </div>
    </div>
  )
}

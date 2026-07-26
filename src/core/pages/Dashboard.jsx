import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';

/**
 * First CORE screen. Static sample data for now — wiring to real data
 * (the v2.5 engine) is the next step. Nothing here assumes "workshop".
 */
export function Dashboard({ tenant }) {
  return (
    <div className="mx-auto max-w-6xl px-8 py-7">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-accent">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" /> Live · {tenant.name}
          </div>
          <h1 className="mt-1 text-4xl">Sunday, 26 July</h1>
        </div>
        <Button><Plus size={16} /> New job</Button>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="In progress" value="4" tone="primary" />
        <StatTile label="Booked" value="3" />
        <StatTile label="Awaiting" value="1" />
        <StatTile label="Ready" value="2" tone="accent" />
        <StatTile label="Parts low" value="2" />
        <StatTile label="Invoiced today" value="$0" />
      </div>

      {/* Panels */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue — last 30 days</CardTitle></CardHeader>
          <CardBody>
            <div className="text-3xl font-semibold">$36,631</div>
            <div className="mt-4 flex h-24 items-end gap-1">
              {[40, 62, 48, 90, 55, 30, 70, 44, 58, 36, 80, 52].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm bg-primary/70" style={{ height: `${h}%` }} />
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Today's activity</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {[
              ['08:30', 'BMW 320i · Service', 'Bay 1'],
              ['10:00', 'Golf GTI · Brakes', 'Bay 2'],
              ['13:15', 'Hilux SR5 · Diagnostic', 'Bay 3'],
            ].map(([time, what, where]) => (
              <div key={time} className="flex items-center justify-between rounded-md bg-secondary/60 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{what}</div>
                  <div className="text-xs text-muted-foreground">{time}</div>
                </div>
                <span className="rounded-full bg-card px-2 py-1 text-xs text-muted-foreground">{where}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Sample data — next step wires this to the live engine.
      </p>
    </div>
  );
}

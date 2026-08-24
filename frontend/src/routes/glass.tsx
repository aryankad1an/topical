import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { LiquidGlass } from '@/components/LiquidGlass';
import {
  LIQUID_GLASS_DEFAULTS,
  LIQUID_GLASS_RANGES,
  type LiquidGlassSettings,
} from '@/lib/liquidGlass';

/**
 * A playground for the Liquid Glass material.
 *
 * The effect is impossible to judge from numbers — refraction only reads
 * against a backdrop with structure in it, and the six settings interact
 * (raising Frost hides Dispersion, raising Splay hides both in the centre).
 * So this puts a draggable pane over deliberately busy content and exposes
 * every control, which is the only way to tell whether a change helped.
 */
export const Route = createFileRoute('/glass')({ component: GlassPlayground });

const KEYS = Object.keys(LIQUID_GLASS_RANGES) as (keyof LiquidGlassSettings)[];

function GlassPlayground() {
  const [settings, setSettings] = useState<LiquidGlassSettings>(LIQUID_GLASS_DEFAULTS);
  const set = (key: keyof LiquidGlassSettings, value: number) =>
    setSettings(s => ({ ...s, [key]: value }));

  return (
    <div className="glass-lab">
      {/* The backdrop. Text, rules and saturated blocks, because each shows a
          different part of the effect: text shows displacement, straight
          rules show the kink at the border, and saturated edges show the
          chromatic split. A gradient alone would hide all three. */}
      <div className="glass-lab-bg" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => (
          <p key={i}>
            The quick brown fox jumps over the lazy dog — refraction bends what is
            behind the pane, magnifies it near the rim, and splits it into colour.
          </p>
        ))}
        <div className="glass-lab-bars">
          {['#d97757', '#4a6fa5', '#3d7d5a', '#c77d2e', '#7a5ca8'].map(c => (
            <span key={c} style={{ background: c }} />
          ))}
        </div>
      </div>

      <LiquidGlass settings={settings} radius={32} className="glass-lab-pane">
        <div className="glass-lab-pane-inner">
          <h2>Liquid Glass</h2>
          <p>Drag the sliders. The pane refracts whatever passes behind it.</p>
        </div>
      </LiquidGlass>

      <aside className="glass-lab-controls" aria-label="Liquid glass settings">
        <h1>Settings</h1>
        {KEYS.map(key => {
          const range = LIQUID_GLASS_RANGES[key];
          const id = `lg-${key}`;
          return (
            <div className="glass-lab-control" key={key}>
              <label htmlFor={id}>
                <span>{range.label}</span>
                <output htmlFor={id}>{settings[key]}</output>
              </label>
              <input
                id={id}
                type="range"
                min={range.min}
                max={range.max}
                step={range.step}
                value={settings[key]}
                onChange={e => set(key, Number(e.target.value))}
                aria-describedby={`${id}-hint`}
              />
              <p className="glass-lab-hint" id={`${id}-hint`}>{range.hint}</p>
            </div>
          );
        })}
        <button
          className="glass-btn w-full mt-2"
          onClick={() => setSettings(LIQUID_GLASS_DEFAULTS)}
        >
          Reset to defaults
        </button>
      </aside>
    </div>
  );
}

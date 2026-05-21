import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <article class="stat-card" [attr.data-tone]="tone()">
      <div class="stat-card__marker">{{ marker() }}</div>
      <div class="stat-card__content">
        <span class="stat-card__label">{{ label() }}</span>
        <strong class="stat-card__value">{{ value() }}</strong>
        <p class="stat-card__detail">{{ detail() }}</p>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      min-width: 0;
    }

    .stat-card {
      position: relative;
      overflow: hidden;
      height: 100%;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 1rem;
      padding: 1.15rem 1.2rem;
      border-radius: 1.2rem;
      border: 1px solid rgba(12, 48, 58, 0.08);
      background: rgba(255, 255, 255, 0.88);
      min-height: 8.5rem;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
      animation: fade-up var(--motion-smooth) both;
      transition:
        transform var(--motion-snappy),
        box-shadow var(--motion-snappy),
        border-color var(--motion-snappy);
    }

    .stat-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.34), transparent 30%),
        radial-gradient(circle at top right, rgba(31, 139, 127, 0.08), transparent 28%);
      pointer-events: none;
    }

    .stat-card::after {
      content: '';
      position: absolute;
      inset: -18% auto -18% -12%;
      width: 32%;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.26),
        transparent
      );
      transform: translateX(-180%) skewX(-22deg);
      opacity: 0;
      pointer-events: none;
    }

    @media (hover: hover) {
      .stat-card:hover {
        transform: translateY(-4px);
        border-color: rgba(31, 139, 127, 0.14);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.75),
          0 24px 48px rgba(10, 38, 48, 0.1);
      }

      .stat-card:hover::after {
        opacity: 1;
        animation: sheen-sweep 900ms var(--motion-snappy);
      }
    }

    .stat-card__marker {
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 0.95rem;
      display: grid;
      place-items: center;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--accent-strong);
      background: rgba(24, 115, 102, 0.12);
    }

    .stat-card[data-tone='warning'] .stat-card__marker {
      color: var(--gold-strong);
      background: rgba(217, 140, 29, 0.12);
    }

    .stat-card[data-tone='critical'] .stat-card__marker {
      color: var(--danger-strong);
      background: rgba(198, 63, 56, 0.12);
    }

    .stat-card__content {
      display: grid;
      gap: 0.4rem;
    }

    .stat-card__label {
      font-size: 0.82rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted-ink);
      font-weight: 700;
    }

    .stat-card__value {
      font: 800 clamp(1.9rem, 2vw, 2.35rem) / 1 var(--font-display);
      letter-spacing: -0.06em;
      color: var(--ink-strong);
    }

    .stat-card__detail {
      margin: 0;
      color: var(--muted-ink);
      line-height: 1.5;
      font-size: 0.92rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly detail = input<string>('');
  readonly marker = input<string>('AG');
  readonly tone = input<'default' | 'warning' | 'critical'>('default');
}

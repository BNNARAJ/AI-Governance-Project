import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-surface-card',
  standalone: true,
  template: `
    <section class="surface-card">
      @if (eyebrow() || title() || subtitle()) {
        <div class="surface-card__header">
          @if (eyebrow()) {
            <span class="surface-card__eyebrow">{{ eyebrow() }}</span>
          }
          @if (title()) {
            <h2>{{ title() }}</h2>
          }
          @if (subtitle()) {
            <p>{{ subtitle() }}</p>
          }
        </div>
      }
      <div class="surface-card__content">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      min-width: 0;
    }

    .surface-card {
      position: relative;
      overflow: hidden;
      height: 100%;
      display: grid;
      grid-template-rows: auto 1fr;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(247, 249, 252, 0.95));
      border: 1px solid var(--line-soft);
      border-radius: 1.35rem;
      padding: 1.4rem;
      box-shadow: 0 22px 50px rgba(10, 38, 48, 0.08);
      animation: fade-up var(--motion-smooth) both;
      transition:
        transform var(--motion-snappy),
        box-shadow var(--motion-snappy),
        border-color var(--motion-snappy);
    }

    .surface-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.45), transparent 28%),
        linear-gradient(115deg, transparent 24%, rgba(255, 255, 255, 0.18), transparent 58%);
      pointer-events: none;
      opacity: 0.72;
    }

    .surface-card::after {
      content: '';
      position: absolute;
      inset: -20% auto -20% -10%;
      width: 34%;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.3),
        transparent
      );
      transform: translateX(-180%) skewX(-22deg);
      opacity: 0;
      pointer-events: none;
    }

    @media (hover: hover) {
      .surface-card:hover {
        transform: translateY(-3px);
        border-color: rgba(31, 139, 127, 0.18);
        box-shadow: 0 28px 54px rgba(10, 38, 48, 0.1);
      }

      .surface-card:hover::after {
        opacity: 1;
        animation: sheen-sweep 920ms var(--motion-snappy);
      }
    }

    .surface-card__header {
      display: grid;
      gap: 0.35rem;
      margin-bottom: 1rem;
      align-content: start;
    }

    .surface-card__content {
      display: grid;
      align-content: start;
      min-height: 0;
    }

    .surface-card__eyebrow {
      font-size: 0.73rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent-strong);
    }

    h2 {
      margin: 0;
      font: 700 1.2rem / 1.2 var(--font-display);
      letter-spacing: -0.03em;
    }

    p {
      margin: 0;
      color: var(--muted-ink);
      line-height: 1.55;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SurfaceCardComponent {
  readonly eyebrow = input<string>('');
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
}

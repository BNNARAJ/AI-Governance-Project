import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AppIconName, IconComponent } from './icon.component';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [IconComponent],
  template: `
    <header class="page-header">
      <div class="page-copy">
        @if (eyebrow()) {
          <span class="eyebrow">{{ eyebrow() }}</span>
        }
        <div class="title-row">
          @if (icon()) {
            <span class="title-icon">
              <app-icon [name]="icon()!" />
            </span>
          }
          <h1>{{ title() }}</h1>
        </div>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <div class="page-actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: `
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 1.5rem;
      align-items: flex-end;
      margin-bottom: 1.75rem;
      animation: fade-up var(--motion-smooth) both;
    }

    .page-copy {
      display: grid;
      gap: 0.45rem;
      max-width: 52rem;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }

    .title-icon {
      width: 2.5rem;
      height: 2.5rem;
      display: inline-grid;
      place-items: center;
      border-radius: 0.95rem;
      background: linear-gradient(135deg, rgba(31, 139, 127, 0.12), rgba(213, 164, 85, 0.18));
      color: var(--accent-strong);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }

    .eyebrow {
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--accent-strong);
    }

    h1 {
      margin: 0;
      font: 700 clamp(2rem, 2.5vw, 3rem) / 1.05 var(--font-display);
      letter-spacing: -0.05em;
    }

    p {
      margin: 0;
      max-width: 48rem;
      color: var(--muted-ink);
      font-size: 1rem;
      line-height: 1.6;
    }

    .page-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
    }

    @media (max-width: 900px) {
      .page-header {
        flex-direction: column;
        align-items: stretch;
      }

      .page-actions {
        justify-content: flex-start;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageHeaderComponent {
  readonly eyebrow = input<string>('');
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly icon = input<AppIconName | null>(null);
}

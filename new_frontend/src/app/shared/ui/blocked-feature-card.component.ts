import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BlockedFeatureState } from '../../core/models/governance.models';
import { SurfaceCardComponent } from './surface-card.component';

@Component({
  selector: 'app-blocked-feature-card',
  standalone: true,
  imports: [SurfaceCardComponent],
  template: `
    <app-surface-card
      eyebrow="Workspace module"
      [title]="feature().title"
      [subtitle]="feature().message"
    >
      <div class="blocked-note">
        <strong>{{ feature().ownerNote }}</strong>
      </div>
    </app-surface-card>
  `,
  styles: `
    .blocked-note {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.55rem 0.8rem;
      background: rgba(31, 139, 127, 0.08);
      color: var(--accent-strong);
      font-size: 0.84rem;
      font-weight: 700;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BlockedFeatureCardComponent {
  readonly feature = input.required<BlockedFeatureState>();
}

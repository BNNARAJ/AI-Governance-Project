import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';

@Component({
  selector: 'app-score-ring',
  standalone: true,
  template: `
    <article class="score-ring-card">
      <div
        class="score-ring"
        [style.--score]="normalizedScore()"
        [attr.data-tone]="tone()"
      >
        <div class="score-ring__inner">
          <strong>{{ score().toFixed(1) }}</strong>
          <span>/ 10</span>
        </div>
      </div>
      <div class="score-ring__copy">
        <h3>{{ label() }}</h3>
        <p>{{ note() || rating() }}</p>
      </div>
    </article>
  `,
  styles: `
    .score-ring-card {
      display: grid;
      gap: 1rem;
      justify-items: center;
      padding: 1rem;
      text-align: center;
      border-radius: 1.15rem;
      background: rgba(248, 250, 251, 0.78);
      border: 1px solid var(--line-soft);
    }

    .score-ring {
      --score-color: var(--accent-strong);
      width: 8.5rem;
      aspect-ratio: 1;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at center, rgba(250, 251, 252, 1) 58%, transparent 58%),
        conic-gradient(var(--score-color) calc(var(--score) * 100%), rgba(15, 62, 73, 0.12) 0);
    }

    .score-ring[data-tone='warning'] {
      --score-color: var(--gold-strong);
    }

    .score-ring[data-tone='critical'] {
      --score-color: var(--danger-strong);
    }

    .score-ring__inner {
      display: grid;
      gap: 0.1rem;
      place-items: center;
    }

    strong {
      font: 800 2rem / 1 var(--font-display);
      letter-spacing: -0.07em;
    }

    span {
      font-size: 0.8rem;
      color: var(--muted-ink);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h3 {
      margin: 0 0 0.25rem;
      font: 700 1rem / 1.2 var(--font-display);
    }

    p {
      margin: 0;
      color: var(--muted-ink);
      line-height: 1.5;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScoreRingComponent {
  readonly label = input.required<string>();
  readonly score = input.required<number>();
  readonly note = input<string>('');

  readonly normalizedScore = computed(() =>
    Math.min(1, Math.max(0, this.score() / 10))
  );

  readonly tone = computed(() => {
    if (this.score() >= 7) {
      return 'default';
    }

    if (this.score() >= 5) {
      return 'warning';
    }

    return 'critical';
  });

  readonly rating = computed(() => {
    if (this.score() >= 8.5) {
      return 'Release ready';
    }

    if (this.score() >= 7) {
      return 'Acceptable with monitoring';
    }

    if (this.score() >= 5) {
      return 'Requires remediation';
    }

    return 'Escalate before release';
  });
}

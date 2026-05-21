import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AppIconName =
  | 'dashboard'
  | 'regulations'
  | 'audit'
  | 'results'
  | 'admin'
  | 'logout'
  | 'shield'
  | 'library'
  | 'spark';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    @switch (name()) {
      @case ('dashboard') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5h7v6H4zM13 5h7v10h-7zM4 13h7v6H4zM13 17h7v2h-7z" />
        </svg>
      }
      @case ('regulations') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3h9l3 3v15H6zM15 3v4h4M9 11h6M9 15h6M9 19h4" />
        </svg>
      }
      @case ('audit') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 5 6v5c0 5 3.4 8.8 7 10 3.6-1.2 7-5 7-10V6z" />
          <path d="m9.5 12 1.7 1.7 3.3-3.4" />
        </svg>
      }
      @case ('results') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 18h14M7 16V9M12 16V6M17 16v-4" />
        </svg>
      }
      @case ('admin') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 4 7v5c0 5.2 3.6 9.4 8 10.8C16.4 21.4 20 17.2 20 12V7z" />
          <path d="M12 9.2a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2ZM8.8 17a3.6 3.6 0 0 1 6.4 0" />
        </svg>
      }
      @case ('logout') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 5H6v14h4M14 8l4 4-4 4M18 12H9" />
        </svg>
      }
      @case ('library') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 5h4v14H5zM10 5h4v14h-4zM15 5h4v14h-4z" />
        </svg>
      }
      @case ('spark') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        </svg>
      }
      @default {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 5 6v5c0 5 3.4 8.8 7 10 3.6-1.2 7-5 7-10V6z" />
        </svg>
      }
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      width: 1em;
      height: 1em;
      flex: 0 0 auto;
    }

    svg {
      width: 100%;
      height: 100%;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IconComponent {
  readonly name = input.required<AppIconName>();
}

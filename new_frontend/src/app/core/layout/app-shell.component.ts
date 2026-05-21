import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { SessionService } from '../services/session.service';
import { UserRole } from '../models/governance.models';
import { AppIconName, IconComponent } from '../../shared/ui/icon.component';

interface NavigationItem {
  label: string;
  icon: AppIconName;
  route: string;
  roles: readonly UserRole[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);
  protected readonly user = this.session.currentUser;
  protected readonly workspaceLabel = computed(() => 'Governance workspace');
  protected readonly navItems = computed(() => {
    const user = this.user();
    if (!user) {
      return [] as NavigationItem[];
    }

    const items: NavigationItem[] = [
      {
        label: 'Dashboard',
        icon: 'dashboard',
        route: '/dashboard',
        roles: ['admin', 'compliance_officer', 'ai_developer']
      },
      {
        label: 'Regulations',
        icon: 'regulations',
        route: '/regulations',
        roles: ['admin', 'compliance_officer']
      },
      {
        label: 'Audit Studio',
        icon: 'audit',
        route: '/audit-config',
        roles: ['admin', 'compliance_officer', 'ai_developer']
      },
      {
        label: 'Results',
        icon: 'results',
        route: '/results',
        roles: ['admin', 'compliance_officer', 'ai_developer']
      },
      {
        label: 'Admin',
        icon: 'admin',
        route: '/admin',
        roles: ['admin']
      }
    ];

    return items.filter((item) => item.roles.includes(user.role));
  });

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
    await this.router.navigateByUrl('/login');
  }

  protected formatRole(role: UserRole | undefined): string {
    if (!role) {
      return '';
    }

    return role
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  protected userInitials(fullName: string | undefined): string {
    if (!fullName) {
      return 'GC';
    }

    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}

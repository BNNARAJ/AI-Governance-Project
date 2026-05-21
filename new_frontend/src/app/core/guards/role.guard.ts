import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../models/governance.models';
import { SessionService } from '../services/session.service';

export const roleGuard =
  (roles: readonly UserRole[]): CanActivateFn =>
  () => {
    const session = inject(SessionService);
    const router = inject(Router);
    const user = session.currentUser();

    if (user && roles.includes(user.role)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SessionService } from '../services/session.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionService);
  const backendBaseUrl = environment.backendBaseUrl.replace(/\/$/, '');
  const token = session.authToken();

  if (!token || !request.url.startsWith(backendBaseUrl)) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    })
  );
};

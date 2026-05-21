import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { UserRole } from '../../core/models/governance.models';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly defaultDepartments: Record<UserRole, string> = {
    admin: 'Governance Office',
    compliance_officer: 'Risk and Compliance',
    ai_developer: 'ML Platform'
  };
  private readonly formBuilder = inject(FormBuilder);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly submitting = this.session.authPending;
  protected readonly authMode = signal<'signin' | 'register'>('signin');
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly modeTitle = computed(() =>
    this.authMode() === 'signin' ? 'AI Governance Console' : 'Create workspace access'
  );
  protected readonly modeCopy = computed(() =>
    this.authMode() === 'signin'
      ? 'Sign in with your workspace credentials.'
      : 'Create a workspace account to begin using the application.'
  );

  protected readonly signInForm = this.formBuilder.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });
  protected readonly registerForm = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required, Validators.minLength(3)]],
    role: ['compliance_officer' as UserRole, Validators.required],
    department: ['Risk and Compliance', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  constructor() {
    if (this.session.isAuthenticated()) {
      void this.router.navigateByUrl('/dashboard');
    }
  }

  protected switchMode(mode: 'signin' | 'register'): void {
    this.authMode.set(mode);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  protected syncDepartment(): void {
    const role = this.registerForm.controls.role.value;
    this.registerForm.controls.department.setValue(this.defaultDepartments[role]);
  }

  protected signInFieldError(fieldName: 'username' | 'password'): string {
    return this.fieldError(this.signInForm.controls[fieldName], {
      username: 'Enter your email or username.',
      password: 'Enter your password.'
    }[fieldName]);
  }

  protected registerFieldError(
    fieldName:
      | 'fullName'
      | 'email'
      | 'username'
      | 'department'
      | 'password'
      | 'confirmPassword'
  ): string {
    const messages = {
      fullName: 'Enter at least 3 characters.',
      email: 'Enter a valid email address.',
      username: 'Enter at least 3 characters.',
      department: 'Enter a department.',
      password: 'Use at least 8 characters.',
      confirmPassword: 'Confirm the password.'
    };

    return this.fieldError(this.registerForm.controls[fieldName], messages[fieldName]);
  }

  protected async submit(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.authMode() === 'signin') {
      await this.submitSignIn();
      return;
    }

    await this.submitRegistration();
  }

  private async submitSignIn(): Promise<void> {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }

    try {
      await this.session.signIn(this.signInForm.getRawValue());

      const redirectTarget =
        this.route.snapshot.queryParamMap.get('redirectTo') ?? '/dashboard';

      await this.router.navigateByUrl(redirectTarget);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to sign in'
      );
    }
  }

  private async submitRegistration(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.errorMessage.set('Complete the highlighted fields to create the account.');
      return;
    }

    const raw = this.registerForm.getRawValue();
    if (raw.password !== raw.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    try {
      await this.session.register({
        username: raw.username.trim(),
        fullName: raw.fullName.trim(),
        email: raw.email.trim(),
        password: raw.password,
        role: raw.role,
        department: raw.department.trim()
      });
      this.successMessage.set('Account created successfully.');
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to create account'
      );
    }
  }

  private fieldError(control: AbstractControl, message: string): string {
    return control.invalid && (control.touched || control.dirty) ? message : '';
  }
}

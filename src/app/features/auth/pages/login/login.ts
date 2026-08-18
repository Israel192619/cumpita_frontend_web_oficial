import { ChangeDetectorRef, Component, signal } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth-service';
import { CommonModule } from '@angular/common';
import { timeout } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { homeForUser } from '../../../../core/auth/role-access';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule, CommonModule,
    RouterLink
],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {

  form: FormGroup;
  nombreApp = environment.nombreApp;
  loading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      email: ['admin@gmail.com', [Validators.required, Validators.email]],
      password: ['Admin2026***', [Validators.required, Validators.minLength(8)]],
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const value = this.form.value;
    const creds: { email: string; password: string } = {
      email: (value.email as string) ?? '',
      password: (value.password as string) ?? ''
    };
    this.auth.login(creds). subscribe({
      next: () => {
        this.auth.me().subscribe({
          next: user => {
            this.loading.set(false);
            this.router.navigateByUrl(homeForUser(user));
          },
          error: () => {
            this.loading.set(false);
            this.error.set('No se pudo verificar el perfil del usuario.');
          }
        });
      },
      error: (err) => {
        if (err.status === 0) {
          this.error.set('No se pudo conectar al servidor. Por favor, verifica tu conexión e inténtalo de nuevo.');
        } else if (err.name === 'TimeoutError') {
          this.error.set('Tiempo de espera agotado');
        } else {
          this.error.set(err?.error?.message || 'Error inesperado');
        }
        this.loading.set(false);
      }
    });
  }

  toggleShowPassword() {
    this.showPassword.set(!this.showPassword());
  }
}

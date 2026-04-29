import { ChangeDetectorRef, Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth-service';
import { CommonModule } from '@angular/common';
import { timeout } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';

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
  loading = false;
  error: string | null = null;
  showPassword = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router, private cd: ChangeDetectorRef) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;
    const value = this.form.value;
    const creds: { email: string; password: string } = {
      email: (value.email as string) ?? '',
      password: (value.password as string) ?? ''
    };
    this.auth.login(creds). subscribe({
      next: () => {
        this.loading = false;
        this.cd.detectChanges();
        this.router.navigateByUrl('/app');
      },
      error: (err) => {
        if (err.status === 0) {
          this.error = 'No se pudo conectar al servidor. Por favor, verifica tu conexión e inténtalo de nuevo.';
        } else if (err.name === 'TimeoutError') {
          this.error = 'Tiempo de espera agotado';
        } else {
          this.error = err?.error?.message || 'Error inesperado';
        }
        this.loading = false;
        this.cd.detectChanges();
      }
    });
  }

  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }
}

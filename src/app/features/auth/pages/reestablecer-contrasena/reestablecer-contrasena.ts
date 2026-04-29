import { ChangeDetectorRef, Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { timeout } from 'rxjs';
import { AuthService } from '../../../../core/services/auth-service';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../../environments/environment';
import { passwordMatchValidator } from '../../../../shared/validators/confirmacion-contrasena';

@Component({
  selector: 'app-reestablecer-contrasena',
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule
  ],
  templateUrl: './reestablecer-contrasena.html',
  styleUrl: './reestablecer-contrasena.css',
})
export class ReestablecerContrasena {
  form: FormGroup;

  nombreApp = environment.nombreApp;
  loading = false;
  error: string | null = null;
  showPassword = false;
  showConfirmPassword = false;

  email = 'admin@gmail.com';
  token = 'qwertyywrwedsfewerwerwefwefwef';

  // ngOnInit(): void {
  //   this.route.queryParams.subscribe(params => {
  //     this.token = params['token'] || '';
  //     this.email = params['email'] || '';
  //   });
  // }

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router, private cd: ChangeDetectorRef, private route: ActivatedRoute) {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
    }, {
      validators: passwordMatchValidator()
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;
    const value = this.form.value;
    const data = {
      email: this.email,
      password: (value.password as string) ?? '',
      token: this.token,
      password_confirmation: value.confirmPassword
    };
    this.auth.reestablecerContrasena(data).pipe(timeout(10000)).subscribe({
      next: () => {
        this.loading = false;
        this.cd.detectChanges();
        this.router.navigateByUrl('/login');
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 0) {
          this.error = 'No se pudo conectar al servidor. Por favor, verifica tu conexión e inténtalo de nuevo.';
        } else {
          this.error = err?.error?.message || 'Error al restablecer contraseña';
        }
        this.cd.detectChanges();
      }
    });
  }

  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }
  toggleShowConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}

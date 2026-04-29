import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { timeout } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth-service';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-olvidaste-contrasena',
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink
  ],
  templateUrl: './olvidaste-contrasena.html',
  styleUrl: './olvidaste-contrasena.css',
})
export class OlvidasteContrasena {

  nombreApp = environment.nombreApp;
  form: FormGroup;
  loading = false;
  error: string | null = null;
  
  constructor(private fb: FormBuilder, private cd: ChangeDetectorRef, private auth: AuthService) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;
    const value = this.form.value;
    const email: string = (value.email as string) ?? '';
    this.auth.olvidasteContrasena(email).pipe(timeout(10000)).subscribe({
      next: () => {
        this.loading = false; 
        this.cd.detectChanges();
      },
      error: (err) => {
        
        if(err.status === 0){
          this.error = 'No se pudo conectar al servidor. Por favor, verifica tu conexión e inténtalo de nuevo.';
        }else if(err.status === 404){
          this.error = err.error?.message || 'Correo no encontrado';
        }else{
          this.error = err?.error?.message || 'Error desconocido. Por favor, inténtalo de nuevo.';
        }
        this.loading = false;
        this.cd.detectChanges();
      }
    });
  }
}

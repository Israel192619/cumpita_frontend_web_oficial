import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable, shareReplay, tap } from 'rxjs';
import { Router } from '@angular/router';
import { User } from '../models';


@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private readonly servicioCerradoKey = 'servicio_celular_cerrado';
  private readonly usuarioCacheKey = 'auth_user';
  private meRequest?: Observable<User>;
  readonly usuarioActual = signal<User | null>(null);

  constructor(private http: HttpClient, private router:Router) {
    this.usuarioActual.set(this.usuarioGuardado());
  }

  login(credentials: { identificador: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      tap((res: any) => {
        if (res?.token) {
          localStorage.setItem('auth_token', res.token);
          this.meRequest = undefined;
          this.limpiarCierreServicioCelular();
        }
      })
    );
  }

  register(data: { name: string; email: string; password: string; password_confirmation: string }) {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  logout() {
    return this.http.post(`${this.apiUrl}/logout`, {}).pipe(
      finalize(() => {
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem(this.usuarioCacheKey);
        this.usuarioActual.set(null);
        this.meRequest = undefined;
        this.limpiarCierreServicioCelular();
        this.router.navigate(['/login']);
      })
    );
  }

  getToken() {
    return localStorage.getItem('auth_token');
  }

  me(): Observable<User> {
    if (!this.meRequest) {
      this.meRequest = this.http.get<User>(`${this.apiUrl}/me`).pipe(
        tap(user => {
          sessionStorage.setItem(this.usuarioCacheKey, JSON.stringify(user));
          this.usuarioActual.set(user);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.meRequest;
  }

  usuarioGuardado(): User | null {
    try {
      const value = sessionStorage.getItem(this.usuarioCacheKey);
      return value ? JSON.parse(value) as User : null;
    } catch {
      return null;
    }
  }

  actualizarPerfil(data: FormData): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/me/profile`, data).pipe(
      tap(user => {
        sessionStorage.setItem(this.usuarioCacheKey, JSON.stringify(user));
        this.usuarioActual.set(user);
        this.meRequest = undefined;
      })
    );
  }

  olvidasteContrasena(identificador: string) {
    return this.http.post(`${this.apiUrl}/olvide-mi-contrasena`, { identificador });
  }

  reestablecerContrasena(credentials: {
    email: string;
    token: string;
    password: string;
    password_confirmation: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/reestablecer-contrasena`, credentials).pipe(
      tap((res: any) => {
        if (res?.access_token) {
          localStorage.setItem('auth_token', res.access_token);
        }
      })
    );
  }
  listarMeserosAccesoRapido(): Observable<{ meseros: { id: number; name: string }[] }> {
    return this.http.get<{ meseros: { id: number; name: string }[] }>(`${this.apiUrl}/acceso-rapido/meseros`);
  }

  marcarCierreServicioCelular(): void {
    sessionStorage.setItem(this.servicioCerradoKey, '1');
  }

  servicioCelularCerrado(): boolean {
    return sessionStorage.getItem(this.servicioCerradoKey) === '1';
  }

  limpiarCierreServicioCelular(): void {
    sessionStorage.removeItem(this.servicioCerradoKey);
  }

  loginConPin(userId: number, pin: string): Observable<{
    token: string;
    session_id: string;
    expires_in: number;
    user: User;
  }>{
    return this.http.post<any>(`${this.apiUrl}/acceso-rapido/pin`, { user_id: userId, pin }, {
      headers: { 'X-Service-Login': '1' }
    });
  }
}

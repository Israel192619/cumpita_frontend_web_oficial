import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';


@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private router:Router) {}

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      tap((res: any) => {
        if (res?.token) {
          localStorage.setItem('auth_token', res.token);
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
        this.router.navigate(['/login']);
      })
    );
  }

  getToken() {
    return localStorage.getItem('auth_token');
  }

  olvidasteContrasena(email: string) {
    return this.http.post(`${this.apiUrl}/olvide-mi-contrasena`, { email });
  }

  reestablecerContrasena(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/reestablecer-contrasena`, credentials).pipe(
      tap((res: any) => {
        if (res?.access_token) {
          localStorage.setItem('auth_token', res.access_token);
        }
      })
    );
  }
}

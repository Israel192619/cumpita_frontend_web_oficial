import { Injectable } from '@angular/core';
import { CreateUser, UpdateUser, User } from '../../../core/models/user';
import { Observable } from 'rxjs/internal/Observable';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { map } from 'rxjs/internal/operators/map';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) { }

  listarUsuarios(): Observable<User[]> {
    return this.http.get<{ users: User[] }>(`${this.apiUrl}/users`)
      .pipe(
        map(res => res.users ?? [])
      );
  }

  eliminarUsuario(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/${id}`);
  }
  crearUsuario(data: FormData): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/users`, data);
  }

  editarUsuario(id: number, user: FormData | UpdateUser): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/users/${id}`, user);
  }

  getRoles(): Observable<{ id: number; nombre: string }[]> {
    return this.http.get<{ roles: any[] }>(`${this.apiUrl}/roles`)
      .pipe(
        map(res => res.roles ?? [])
      );
  }

  getUsuarioPorId(id: number): Observable<User> {
    return this.http.get<{ user: User }>(`${this.apiUrl}/users/${id}`)
    .pipe(
      map(res => res.user)
    );
  }
}

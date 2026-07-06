import { Injectable } from '@angular/core';
import { CreateCliente, UpdateCliente, Cliente } from '../../../core/models/cliente';
import { Observable } from 'rxjs/internal/Observable';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { map } from 'rxjs/internal/operators/map';

@Injectable({
  providedIn: 'root',
})
export class ClienteService {
  private apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) { }

  listarClientes(): Observable<Cliente[]> {
    return this.http.get<{ clientes: Cliente[] }>(`${this.apiUrl}/clientes`)
      .pipe(
        map(res => res.clientes ?? [])
      );
  }

  eliminarCliente(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/clientes/${id}`);
  }

  crearCliente(data: CreateCliente): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/clientes`, data);
  }

  editarCliente(id: number, cliente: UpdateCliente): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/clientes/${id}`, cliente);
  }

  getClientePorId(id: number): Observable<Cliente> {
    return this.http.get<{ cliente: Cliente }>(`${this.apiUrl}/clientes/${id}`)
      .pipe(
        map(res => res.cliente)
      );
  }
}


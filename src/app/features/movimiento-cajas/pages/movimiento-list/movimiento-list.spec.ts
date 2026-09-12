import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';

import { MovimientoList } from './movimiento-list';
import { MovimientoService } from '../../services/movimiento-service';

describe('MovimientoList', () => {
  let component: MovimientoList;
  let fixture: ComponentFixture<MovimientoList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovimientoList],
      providers: [
        provideRouter([]),
        {
          provide: MovimientoService,
          useValue: { listar: () => of([]), anular: () => of({}) },
        },
        {
          provide: ToastrService,
          useValue: { success: () => undefined, error: () => undefined },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovimientoList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

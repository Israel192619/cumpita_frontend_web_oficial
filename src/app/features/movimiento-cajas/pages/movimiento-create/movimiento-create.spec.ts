import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovimientoCreate } from './movimiento-create';

describe('MovimientoCreate', () => {
  let component: MovimientoCreate;
  let fixture: ComponentFixture<MovimientoCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovimientoCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovimientoCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

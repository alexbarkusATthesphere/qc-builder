import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReferenceValues } from './reference-values';

describe('ReferenceValues', () => {
  let component: ReferenceValues;
  let fixture: ComponentFixture<ReferenceValues>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReferenceValues]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReferenceValues);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

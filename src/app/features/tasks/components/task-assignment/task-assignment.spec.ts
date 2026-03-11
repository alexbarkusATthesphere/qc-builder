import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskAssignment } from './task-assignment';

describe('TaskAssignment', () => {
  let component: TaskAssignment;
  let fixture: ComponentFixture<TaskAssignment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskAssignment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskAssignment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

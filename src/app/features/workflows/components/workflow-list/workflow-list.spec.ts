import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkflowList } from './workflow-list';

describe('WorkflowList', () => {
  let component: WorkflowList;
  let fixture: ComponentFixture<WorkflowList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkflowList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

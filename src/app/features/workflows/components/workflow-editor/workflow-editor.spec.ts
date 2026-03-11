import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkflowEditor } from './workflow-editor';

describe('WorkflowEditor', () => {
  let component: WorkflowEditor;
  let fixture: ComponentFixture<WorkflowEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkflowEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

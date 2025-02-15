import { TestBed } from '@angular/core/testing';

import { sampleWithRequiredData, sampleWithNewData } from '../squeal.test-samples';

import { SquealFormService } from './squeal-form.service';

describe('Squeal Form Service', () => {
  let service: SquealFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SquealFormService);
  });

  describe('Service methods', () => {
    describe('createSquealFormGroup', () => {
      it('should create a new form with FormControl', () => {
        const formGroup = service.createSquealFormGroup();

        expect(formGroup.controls).toEqual(
          expect.objectContaining({
            id: expect.any(Object),
            user_id: expect.any(Object),
            timestamp: expect.any(Object),
            body: expect.any(Object),
            img: expect.any(Object),
            img_name: expect.any(Object),
            video_content_type: expect.any(Object),
            video_name: expect.any(Object),
            n_characters: expect.any(Object),
            squeal_id_response: expect.any(Object),
            refresh_time: expect.any(Object),
          })
        );
      });

      it('passing ISqueal should create a new form with FormGroup', () => {
        const formGroup = service.createSquealFormGroup(sampleWithRequiredData);

        expect(formGroup.controls).toEqual(
          expect.objectContaining({
            id: expect.any(Object),
            user_id: expect.any(Object),
            timestamp: expect.any(Object),
            body: expect.any(Object),
            img: expect.any(Object),
            img_name: expect.any(Object),
            video_content_type: expect.any(Object),
            video_name: expect.any(Object),
            n_characters: expect.any(Object),
            squeal_id_response: expect.any(Object),
            refresh_time: expect.any(Object),
          })
        );
      });
    });

    describe('getSqueal', () => {
      it('should return NewSqueal for default Squeal initial value', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const formGroup = service.createSquealFormGroup(sampleWithNewData);

        const squeal = service.getSqueal(formGroup) as any;

        expect(squeal).toMatchObject(sampleWithNewData);
      });

      it('should return NewSqueal for empty Squeal initial value', () => {
        const formGroup = service.createSquealFormGroup();

        const squeal = service.getSqueal(formGroup) as any;

        expect(squeal).toMatchObject({});
      });

      it('should return ISqueal', () => {
        const formGroup = service.createSquealFormGroup(sampleWithRequiredData);

        const squeal = service.getSqueal(formGroup) as any;

        expect(squeal).toMatchObject(sampleWithRequiredData);
      });
    });

    describe('resetForm', () => {
      it('passing ISqueal should not enable id FormControl', () => {
        const formGroup = service.createSquealFormGroup();
        expect(formGroup.controls.id.disabled).toBe(true);

        service.resetForm(formGroup, sampleWithRequiredData);

        expect(formGroup.controls.id.disabled).toBe(true);
      });

      it('passing NewSqueal should disable id FormControl', () => {
        const formGroup = service.createSquealFormGroup(sampleWithRequiredData);
        expect(formGroup.controls.id.disabled).toBe(true);

        service.resetForm(formGroup, { _id: null });

        expect(formGroup.controls.id.disabled).toBe(true);
      });
    });
  });
});

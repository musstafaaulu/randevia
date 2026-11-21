import { Appointment } from '../models/Appointment.model';
import { Availability, IAvailability } from '../models/Availability.model';
import { Doctor, IDoctor } from '../models/Doctor.model';
import { ApiError } from '../utils/ApiError';
import type {
  AddAvailabilityInput,
  UpsertDoctorProfileInput,
} from '../validations/doctor.validation';

export async function listDoctors(): Promise<IDoctor[]> {
  return Doctor.find().sort({ createdAt: -1 });
}

export async function getDoctorById(
  id: string,
): Promise<{ doctor: IDoctor; availability: IAvailability[]; bookedSlots: Date[] }> {
  const doctor = await Doctor.findById(id);
  if (!doctor) {
    throw new ApiError(404, 'Doctor not found');
  }

  const [availability, booked] = await Promise.all([
    Availability.find({
      doctorId: doctor._id,
      startTime: { $gte: new Date() },
    }).sort({
      startTime: 1,
    }),
    // Lets the booking UI grey out already-taken times without exposing
    // whose appointment it is; combined with the "slot.updated" socket
    // event, it is what makes availability feel live.
    Appointment.find({
      doctorId: doctor._id,
      status: { $in: ['pending', 'confirmed'] },
      date: { $gte: new Date() },
    }).select('date'),
  ]);

  return { doctor, availability, bookedSlots: booked.map((appointment) => appointment.date) };
}

export async function upsertDoctorProfile(
  userId: string,
  input: UpsertDoctorProfileInput,
): Promise<IDoctor> {
  const doctor = await Doctor.findOneAndUpdate(
    { userId },
    { $set: { specialty: input.specialty, bio: input.bio } },
    { returnDocument: 'after', upsert: true, runValidators: true },
  );

  return doctor;
}

export async function addAvailability(
  userId: string,
  input: AddAvailabilityInput,
): Promise<IAvailability> {
  const doctor = await Doctor.findOne({ userId });
  if (!doctor) {
    throw new ApiError(
      404,
      'Doctor profile not found. Create your profile before adding availability',
    );
  }

  return Availability.create({
    doctorId: doctor._id,
    startTime: input.startTime,
    endTime: input.endTime,
  });
}

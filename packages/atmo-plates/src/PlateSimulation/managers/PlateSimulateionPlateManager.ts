addFirstStep(platelet: PlateletIF) {
  const plateletSteps = this.sim.simUniv.get(COLLECTIONS.PLATELET_STEPS);
  const currentStep = this.sim.simulation.step;

  // Initialize first step with current position and zero velocity
  const step: PlateletStepIF = {
    id: `${platelet.id}_${currentStep}`,
    plateId: platelet.plateId,
    plateletId: platelet.id,
    step: currentStep,
    position: platelet.position,
    thickness: platelet.thickness,
    float: platelet.float,
    h3Index: platelet.h3Index
  };
  plateletSteps.add(step);

  // Update platelet with initial values
  platelet.velocity = new Vector3(0, 0, 0);
  platelet.lastPosition = new Vector3().copy(platelet.position);
  platelet.lastStep = currentStep;
  platelet.lastH3Index = platelet.h3Index;
  platelet.lastFloat = platelet.float;
  platelet.lastThickness = platelet.thickness;
}

initPlateSteps(plateId: string) {
  const plate = this.sim.getPlate(plateId);
  const platelets = this.sim.simUniv.get(COLLECTIONS.PLATELETS);
  const platePlatelets = platelets.find({ plateId });
  
  // Initialize steps for each platelet
  platePlatelets.forEach(platelet => {
    this.addFirstStep(platelet);
  });
}

movePlate(plateId: string): SimStepIF {
  const plate = this.sim.getPlate(plateId);
  const platelets = this.sim.simUniv.get(COLLECTIONS.PLATELETS);
  const plateletSteps = this.sim.simUniv.get(COLLECTIONS.PLATELET_STEPS);
  const currentStep = this.sim.simulation.step;

  // Get all platelets for this plate
  const platePlatelets = platelets.find({ plateId });
  
  // Move each platelet
  platePlatelets.forEach(platelet => {
    // Calculate movement
    const movement = this.calculatePlateletMovement(platelet, plate);
    
    // Update platelet position and properties
    platelet.position.add(movement);
    platelet.float += movement.y;
    platelet.thickness = Math.max(0, platelet.thickness + movement.y);
    
    // Update H3 index if position changed significantly
    const newH3Index = this.updateH3Index(platelet);
    
    // Create step record
    const step: PlateletStepIF = {
      id: `${platelet.id}_${currentStep}`,
      plateId,
      plateletId: platelet.id,
      step: currentStep,
      position: platelet.position,
      thickness: platelet.thickness,
      float: platelet.float,
      h3Index: newH3Index
    };
    plateletSteps.add(step);
    
    // Update last values
    platelet.lastPosition = new Vector3().copy(platelet.position);
    platelet.lastStep = currentStep;
    platelet.lastH3Index = newH3Index;
    platelet.lastFloat = platelet.float;
    platelet.lastThickness = platelet.thickness;
  });

  // Return plate movement step
  return {
    id: `${plateId}_${currentStep}`,
    plateId,
    step: currentStep,
    speed: 0, // TODO: Calculate actual speed
    position: plate.position,
    velocity: new Vector3(0, 0, 0), // TODO: Calculate actual velocity
    start: new Vector3().copy(plate.position)
  };
} 
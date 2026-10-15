(() => {
  "use strict";

  const STORAGE_KEY = "fuelcalc.cars.v1";
  const $ = (id) => document.getElementById(id);

  const carSelect = $("carSelect");
  const distanceInput = $("distance");
  const fuelPriceInput = $("fuelPrice");
  const carsList = $("carsList");
  const emptyState = $("emptyState");
  const carCount = $("carCount");
  const dialog = $("carDialog");
  const form = $("carForm");

  let cars = loadCars();

  function loadCars() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((car) =>
        car && typeof car.id === "string" &&
        typeof car.name === "string" &&
        Number.isFinite(Number(car.consumption)) &&
        Number(car.consumption) > 0
      );
    } catch (error) {
      console.warn("FuelCalc: неуспешно зареждане на запазените автомобили.", error);
      return [];
    }
  }

  function saveCars() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cars));
      return true;
    } catch (error) {
      alert("Автомобилите не можаха да се запазят. Провери настройките или свободното място на браузъра.");
      console.error(error);
      return false;
    }
  }

  function selectedCar() {
    return cars.find((car) => car.id === carSelect.value) || null;
  }

  function formatNumber(value, digits = 2) {
    return new Intl.NumberFormat("bg-BG", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(Number.isFinite(value) ? value : 0);
  }

  function currency(value) {
    return `${formatNumber(value)} €`;
  }

  function unitFor(fuelType) {
    return fuelType === "Електричество" ? "kWh/100 км" : "л/100 км";
  }

  function priceUnitFor(fuelType) {
    return fuelType === "Електричество" ? "€/kWh" : "€/л";
  }

  function renderSelect(preferredId) {
    const previous = preferredId || carSelect.value;
    carSelect.replaceChildren();

    if (cars.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Първо добави автомобил";
      carSelect.append(option);
      carSelect.disabled = true;
      return;
    }

    carSelect.disabled = false;
    for (const car of cars) {
      const option = document.createElement("option");
      option.value = car.id;
      option.textContent = car.name;
      carSelect.append(option);
    }

    carSelect.value = cars.some((car) => car.id === previous) ? previous : cars[0].id;
    if (!carSelect.value) carSelect.value = cars[0].id;
  }

  function renderCars() {
    carsList.replaceChildren();
    emptyState.hidden = cars.length > 0;
    carCount.textContent = `${cars.length} ${cars.length === 1 ? "кола" : "коли"}`;

    for (const car of cars) {
      const card = document.createElement("article");
      card.className = "car-card";

      const avatar = document.createElement("div");
      avatar.className = "car-avatar";
      avatar.textContent = car.fuelType === "Електричество" ? "⚡" :
        car.fuelType === "LPG" ? "🔥" : "🚘";
      avatar.setAttribute("aria-hidden", "true");

      const info = document.createElement("div");
      info.className = "car-info";
      const name = document.createElement("strong");
      name.textContent = car.name;
      const detail = document.createElement("small");
      detail.textContent = `${car.fuelType} · ${formatNumber(Number(car.consumption))} ${unitFor(car.fuelType)}`;
      info.append(name, detail);

      const actions = document.createElement("div");
      actions.className = "car-actions";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "icon-button";
      edit.title = `Редактирай ${car.name}`;
      edit.setAttribute("aria-label", `Редактирай ${car.name}`);
      edit.textContent = "✎";
      edit.addEventListener("click", () => openEditDialog(car.id));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button danger";
      remove.title = `Изтрий ${car.name}`;
      remove.setAttribute("aria-label", `Изтрий ${car.name}`);
      remove.textContent = "⌫";
      remove.addEventListener("click", () => deleteCar(car.id));

      actions.append(edit, remove);
      card.append(avatar, info, actions);
      carsList.append(card);
    }
  }

  function updateFuelPriceForSelectedCar() {
    const car = selectedCar();
    if (car) {
      fuelPriceInput.value = car.defaultPrice === "" ? "" : String(car.defaultPrice);
      $("selectedCarInfo").textContent =
        `${car.fuelType} · ${formatNumber(Number(car.consumption))} ${unitFor(car.fuelType)}`;
      $("consumptionResult").textContent =
        `${formatNumber(Number(car.consumption))} ${unitFor(car.fuelType)}`;
    } else {
      $("selectedCarInfo").textContent = "Добави автомобил, за да започнеш.";
      $("consumptionResult").textContent = "—";
      fuelPriceInput.value = "";
    }
    calculate();
  }

  function calculate() {
    const car = selectedCar();
    const distance = Number(distanceInput.value);
    const price = Number(fuelPriceInput.value);
    const consumption = car ? Number(car.consumption) : 0;
    const validDistance = distanceInput.value.trim() !== "" && Number.isFinite(distance) && distance >= 0;
    const validPrice = fuelPriceInput.value.trim() !== "" && Number.isFinite(price) && price >= 0;
    const validConsumption = Number.isFinite(consumption) && consumption > 0;

    if (!car || !validDistance || !validPrice || !validConsumption) {
      $("litersResult").textContent = "—";
      $("costResult").textContent = "—";
      $("costPerKm").textContent = "Въведи валидни стойности.";
      return;
    }

    const amount = distance * consumption / 100;
    const total = amount * price;
    $("litersResult").textContent = `${formatNumber(amount)} ${car.fuelType === "Електричество" ? "kWh" : "л"}`;
    $("consumptionResult").textContent = `${formatNumber(consumption)} ${unitFor(car.fuelType)}`;
    $("costResult").textContent = currency(total);
    $("costPerKm").textContent = `${currency(distance > 0 ? total / distance : 0)} на километър`;
  }

  function updateFormUnits() {
    const fuelType = $("carFuelType").value;
    $("consumptionUnit").textContent = unitFor(fuelType);
    $("priceUnit").textContent = priceUnitFor(fuelType);
  }

  function openNewDialog() {
    form.reset();
    $("carId").value = "";
    $("dialogEyebrow").textContent = "НОВ АВТОМОБИЛ";
    $("dialogTitle").textContent = "Добави автомобил";
    $("formError").textContent = "";
    $("carFuelType").value = "Бензин";
    $("carDefaultPrice").value = fuelPriceInput.value || "";
    updateFormUnits();
    dialog.showModal();
    $("carName").focus();
  }

  function openEditDialog(id) {
    const car = cars.find((item) => item.id === id);
    if (!car) return;
    $("carId").value = car.id;
    $("carName").value = car.name;
    $("carFuelType").value = car.fuelType;
    $("carConsumption").value = car.consumption;
    $("carDefaultPrice").value = car.defaultPrice;
    $("dialogEyebrow").textContent = "РЕДАКТИРАНЕ";
    $("dialogTitle").textContent = "Промени автомобила";
    $("formError").textContent = "";
    updateFormUnits();
    dialog.showModal();
    $("carName").focus();
  }

  function deleteCar(id) {
    const car = cars.find((item) => item.id === id);
    if (!car) return;
    if (!confirm(`Сигурен ли си, че искаш да изтриеш „${car.name}“?`)) return;
    const oldSelectedId = carSelect.value;
    cars = cars.filter((item) => item.id !== id);
    if (!saveCars()) {
      cars.push(car);
      return;
    }
    renderSelect(oldSelectedId === id ? "" : oldSelectedId);
    renderCars();
    updateFuelPriceForSelectedCar();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const id = $("carId").value;
    const name = $("carName").value.trim();
    const fuelType = $("carFuelType").value;
    const consumption = Number($("carConsumption").value);
    const defaultPriceText = $("carDefaultPrice").value.trim();
    const defaultPrice = defaultPriceText === "" ? "" : Number(defaultPriceText);
    const error = $("formError");

    if (!name) {
      error.textContent = "Въведи име на автомобила.";
      return;
    }
    if (!Number.isFinite(consumption) || consumption <= 0 || consumption > 200) {
      error.textContent = "Разходът трябва да е число над 0 и до 200.";
      return;
    }
    if (defaultPriceText !== "" && (!Number.isFinite(defaultPrice) || defaultPrice < 0 || defaultPrice > 100000)) {
      error.textContent = "Въведи валидна цена на горивото.";
      return;
    }

    const car = {
      id: id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      name,
      fuelType,
      consumption,
      defaultPrice: defaultPrice === "" ? "" : defaultPrice
    };

    const oldCars = cars.slice();
    if (id) {
      cars = cars.map((item) => item.id === id ? car : item);
    } else {
      cars.push(car);
    }

    if (!saveCars()) {
      cars = oldCars;
      return;
    }

    dialog.close();
    renderSelect(car.id);
    renderCars();
    updateFuelPriceForSelectedCar();
  });

  $("addCarBtn").addEventListener("click", openNewDialog);
  $("closeDialog").addEventListener("click", () => dialog.close());
  $("cancelDialog").addEventListener("click", () => dialog.close());
  $("carFuelType").addEventListener("change", updateFormUnits);
  carSelect.addEventListener("change", updateFuelPriceForSelectedCar);
  distanceInput.addEventListener("input", calculate);
  fuelPriceInput.addEventListener("input", calculate);

  renderSelect();
  renderCars();
  updateFuelPriceForSelectedCar();
})();

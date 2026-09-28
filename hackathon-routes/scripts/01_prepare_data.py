import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.io.load_tasks import load_all_tasks
from src.io.load_engineers import save_engineers
from src.geo.geocode import geocode_tasks
from src.ml.duration import add_durations_to_tasks
from src.config import DATA_PROC


def main():
    save_engineers()
    all_tasks = load_all_tasks()
    for name, tasks in all_tasks.items():
        tasks = geocode_tasks(tasks, use_nominatim=False)
        engineers = json.loads((DATA_PROC / f"engineers_{name}.json").read_text(encoding="utf-8"))
        tasks = add_durations_to_tasks(tasks, engineers)
        fp = DATA_PROC / f"tasks_{name}_final.csv"
        tasks.to_csv(fp, index=False)
        print(f"[{name}] {len(tasks)} задач → {fp}")


if __name__ == "__main__":
    main()
# demo.tree file created using the following script

import tskit
import msprime
import collections

from matplotlib import pyplot as plt

seq_length = 1e6
recent_generations = 200
rho = 1e-7
tree = "((A:250,B:250):150,(C:210,D:210):190);"
initial_size = collections.defaultdict(lambda: 500)
initial_size.update({"A": 500, "B": 500, "C": 300, "D": 1000})
samples = {"A": 10, "B": 10, "C": 10, "D": 10}

ts_store = []
for name, Ne in initial_size.items():
    demography = msprime.Demography()
    demography.add_population(name=name, initial_size=Ne)
    # Place a selective sweep in population A
    if name == "A":
        p = 1 / (2 * Ne)
        sweep_model = msprime.SweepGenicSelection(
            position=seq_length//3,
            s=0.1,
            start_frequency=p,
            end_frequency=1 - p,
            dt=1 / (40 * Ne),
        )
    ts_store.append(msprime.sim_ancestry(
        samples[name],
        model=(sweep_model, msprime.StandardCoalescent()) if name == "A" else msprime.StandardCoalescent(),
        demography=demography,
        recombination_rate=rho,
        sequence_length=seq_length,
        end_time=recent_generations,
        random_seed=123,
    ))
tables = ts_store[0].dump_tables()
for ts in ts_store[1:]:
    tables.union(ts.dump_tables(), node_mapping=[tskit.NULL] * ts.num_nodes)
tables.provenances.clear()

demography = msprime.Demography.from_species_tree(tree, initial_size)
ts = msprime.sim_ancestry(initial_state=tables.tree_sequence(), recombination_rate=rho, sequence_length=seq_length, demography=demography, random_seed=123).simplify()
ts = msprime.sim_mutations(ts, rate=5e-8, random_seed=123)
ts.dump("data/demo.trees")
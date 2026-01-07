import collections
import itertools
import sys

import numpy as np
from IPython.display import HTML

def remove_edges(ts, edge_id_remove_list):
    edges_to_remove_by_child = collections.defaultdict(list)
    edge_id_remove_list = set(edge_id_remove_list)
    for m in ts.mutations():
        if m.edge in edge_id_remove_list:
            # If we remove this edge, we will remove the associated mutation
            # as the child node won't have ancestral material in this region.
            # So we force the user to explicitly (re)move the mutations beforehand
            raise ValueError("Cannot remove edges that have associated mutations")
    for remove_edge in edge_id_remove_list:
        e = ts.edge(remove_edge)
        edges_to_remove_by_child[e.child].append(e)

    # sort left-to-right for each child
    for k, v in edges_to_remove_by_child.items():
        edges_to_remove_by_child[k] = sorted(v, key=lambda e: e.left)
        # check no overlaps
        for e1, e2 in zip(edges_to_remove_by_child[k], edges_to_remove_by_child[k][1:]):
            assert e1.right <= e2.left

    # Sanity check: this means the topmost node will deal with modified edges left at the end
    assert ts.edge(-1).parent not in edges_to_remove_by_child
    
    new_edges = collections.defaultdict(list)
    tables = ts.dump_tables()
    tables.edges.clear()
    samples = set(ts.samples())
    # Edges are sorted by parent time, youngest first, so we can iterate over
    # nodes-as-parents visiting children before parents by using itertools.groupby
    for parent_id, ts_edges in itertools.groupby(ts.edges(), lambda e: e.parent):
        # Iterate through the ts edges *plus* the polytomy edges we created in previous steps.
        # This allows us to re-edit polytomy edges when the edges_to_remove are stacked
        edges = list(ts_edges)
        if parent_id in new_edges:
             edges += new_edges.pop(parent_id)
        if parent_id in edges_to_remove_by_child:
            for e in edges:
                assert parent_id == e.parent
                l = -1
                if e.id in edge_id_remove_list:
                    continue
                # NB: we go left to right along the target edges, reducing edge e as required
                for target_edge in edges_to_remove_by_child[parent_id]:
                    # As we go along the target_edges, gradually split e into chunks.
                    # If edge e is in the target_edge region, change the edge parent
                    assert target_edge.left > l
                    l = target_edge.left
                    if e.left >= target_edge.right:
                        # This target edge is entirely to the LHS of edge e, with no overlap
                        continue
                    elif e.right <= target_edge.left:
                        # This target edge is entirely to the RHS of edge e with no overlap.
                        # Since target edges are sorted by left coord, all other target edges
                        # are to RHS too, and we are finished dealing with edge e
                        tables.edges.append(e)
                        e = None
                        break
                    else:
                        # Edge e must overlap with current target edge somehow
                        if e.left < target_edge.left:
                            # Edge had region to LHS of target
                            # Add the left hand section (change the edge right coord)
                            tables.edges.add_row(left=e.left, right=target_edge.left, parent=e.parent, child=e.child)
                            e = e.replace(left=target_edge.left)
                        if e.right > target_edge.right:
                            # Edge continues after RHS of target
                            assert e.left < target_edge.right
                            new_edges[target_edge.parent].append(
                                e.replace(right=target_edge.right, parent=target_edge.parent)
                            )
                            e = e.replace(left=target_edge.right)
                        else:
                            # No more of edge e to RHS
                            assert e.left < e.right
                            new_edges[target_edge.parent].append(e.replace(parent=target_edge.parent))
                            e = None
                            break
                if e is not None:
                    # Need to add any remaining regions of edge back in 
                    tables.edges.append(e)
        else:
            # NB: sanity check at top means that the oldest node will have no edges above,
            # so the last iteration should hit this branch
            for e in edges:
                if e.id not in edge_id_remove_list:
                    tables.edges.append(e)
    assert len(new_edges) == 0
    tables.sort()
    return tables.tree_sequence()

def unsupported_edges(ts, per_interval=False):
    """
    Return the internal edges that are unsupported by a mutation.
    If ``per_interval`` is True, each interval needs to be supported,
    otherwise, a mutation on an edge (even if there are multiple intervals
    per edge) will result in all intervals on that edge being treated
    as supported.
    """
    edges_to_remove = np.ones(ts.num_edges, dtype="bool")
    edges_to_remove[[m.edge for m in ts.mutations()]] = False
    # We don't remove edges above samples
    edges_to_remove[np.isin(ts.edges_child, ts.samples())] = False

    if per_interval:
        return np.where(edges_to_remove)[0]
    else:
        keep = (edges_to_remove == False)
        for p, c in zip(ts.edges_parent[keep], ts.edges_child[keep]):
            edges_to_remove[np.logical_and(ts.edges_parent == p, ts.edges_child == c)] = False
        return np.where(edges_to_remove)[0]


class Workbook:
    @staticmethod
    def setup():
        display(HTML(
            "<style type='text/css'>" +
            ".exercise {background-color: yellow; color: black; font-family: 'serif'; font-size: 1.2em}" +
            ".exercise code {font-size: 0.7em}" +
            "p a > code {color: #0000EE !important; } p a:visited > code {color: #551A8B !important; }" +
            "</style>" + 
            "<h4>✅ Your notebook is ready to go!</h4>" +
            ("This notebook is not running in JupyterLite: you may need to install tskit, tszip, etc."
             if sys.platform != 'emscripten' else '''
To clear the notebook and reset,
select "Clear Browser Data" from the JupyterLite help menu.
''')
    ))

    def node_coalescence_status(arg):
        """
        Uses the num_children_array attribute to find nodes that represent local coalescence.
        See https://tskit.dev/tskit/docs/latest/python-api.html#tskit.Tree.num_children_array
        Returns an array of length num_nodes containing 0 if a node never has any coalescent
        segments, 1 if some segments of the node are coalescent and some unary, and 2 if
        all node segments represent a local coalescence point.
        """
        has_unary = np.zeros(arg.num_nodes, dtype=int)
        has_coal = np.zeros(arg.num_nodes, dtype=int)
        tree = arg.first()
        nca = tree.num_children_array
        for edge_diffs in arg.edge_diffs():
            for e in edge_diffs.edges_out:
                if nca[e.parent] == 0:
                    has_unary[e.parent] = 1
                elif nca[e.parent] > 1:
                    has_coal[e.parent] = 1
            for e in edge_diffs.edges_in:
                if nca[e.parent] == 0:
                    has_unary[e.parent] = 1
                elif nca[e.parent] > 1:
                    has_coal[e.parent] = 1
            tree.next()
        return np.where(has_coal, np.where(has_unary, 1, 2), 0)

    def remove_unsupported_edges(ts, per_interval=True):
        """
        Remove edges from the tree sequence that are unsupported by mutations.
        If ``per_interval`` is True, each interval needs to be supported,
        otherwise, a mutation on an edge (even if there are multiple intervals
        per edge) will result in all intervals on that edge being treated
        as supported.
        """
        edges_to_remove = unsupported_edges(ts, per_interval=per_interval)
        tables = remove_edges(ts, edges_to_remove).dump_tables()
        tables.edges.squash()
        return tables.tree_sequence()

class Workbook1(Workbook):
    url = "json/WhatIsAnARG/Workbook1/" # could also put a full URL here, but a local one will work offline too

class Workbook2(Workbook):
    url = "json/WhatIsAnARG/Workbook2/" # could also put a full URL here, but a local one will work offline too
